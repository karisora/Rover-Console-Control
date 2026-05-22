from __future__ import annotations

import asyncio
import json
import math
import os
import signal
import subprocess
import threading
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

import cv2
import rclpy
from cv_bridge import CvBridge
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from pydantic import BaseModel
from rclpy.node import Node
from sensor_msgs.msg import Image, JointState


Action = Literal[
    "forward",
    "backward",
    "rotate_left",
    "rotate_right",
    "strafe_left",
    "strafe_right",
    "stop",
]


@dataclass
class Pose:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    roll: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0


@dataclass
class WheelRpm:
    frontLeft: float = 0.0
    frontRight: float = 0.0
    rearLeft: float = 0.0
    rearRight: float = 0.0


@dataclass
class SimState:
    connected: bool = True
    running: bool = False
    mode: str = "idle"
    simTimeSec: float = 0.0
    pose: Pose = field(default_factory=Pose)
    wheelRpm: WheelRpm = field(default_factory=WheelRpm)
    cameraStreamUrl: str = "/api/sim/camera/stream"
    message: str | None = None
    lastUpdatedAt: str | None = None


class MoveRequest(BaseModel):
    action: Action
    speed: float = 30.0


class CommandRequest(BaseModel):
    command: str
    value: float = 0.0


class StartRequest(BaseModel):
    world: str = "home_rover_world"
    model: str = "lumos1"
    reset: bool = True


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def quaternion_to_euler_deg(x: float, y: float, z: float, w: float) -> tuple[float, float, float]:
    sinr_cosp = 2 * (w * x + y * z)
    cosr_cosp = 1 - 2 * (x * x + y * y)
    roll = math.atan2(sinr_cosp, cosr_cosp)

    sinp = 2 * (w * y - z * x)
    pitch = math.copysign(math.pi / 2, sinp) if abs(sinp) >= 1 else math.asin(sinp)

    siny_cosp = 2 * (w * z + x * y)
    cosy_cosp = 1 - 2 * (y * y + z * z)
    yaw = math.atan2(siny_cosp, cosy_cosp)

    return math.degrees(roll), math.degrees(pitch), math.degrees(yaw)


class RosAdapter(Node):
    def __init__(self) -> None:
        super().__init__("rover_sim_http_bridge")
        self.state = SimState(lastUpdatedAt=now_iso())
        self.lock = threading.Lock()
        self.cv_bridge = CvBridge()
        self.latest_jpeg: bytes | None = None

        self.cmd_vel_topic = os.getenv("SIM_CMD_VEL_TOPIC", "/cmd_vel")
        self.odom_topic = os.getenv("SIM_ODOM_TOPIC", "/odom")
        self.joint_topic = os.getenv("SIM_JOINT_TOPIC", "/joint_states")
        self.camera_topic = os.getenv("SIM_CAMERA_TOPIC", "/camera/image_raw")

        self.cmd_pub = self.create_publisher(Twist, self.cmd_vel_topic, 10)
        self.create_subscription(Odometry, self.odom_topic, self.on_odom, 10)
        self.create_subscription(JointState, self.joint_topic, self.on_joint_state, 10)
        self.create_subscription(Image, self.camera_topic, self.on_image, 10)

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return asdict(self.state)

    def update_running(self, running: bool, mode: str, message: str | None = None) -> None:
        with self.lock:
            self.state.running = running
            self.state.mode = mode
            self.state.message = message
            self.state.lastUpdatedAt = now_iso()

    def publish_move(self, action: Action, speed: float) -> None:
        normalized = max(-100.0, min(100.0, speed)) / 100.0
        twist = Twist()

        if action == "forward":
            twist.linear.x = abs(normalized)
        elif action == "backward":
            twist.linear.x = -abs(normalized)
        elif action == "rotate_left":
            twist.angular.z = abs(normalized)
        elif action == "rotate_right":
            twist.angular.z = -abs(normalized)
        elif action == "strafe_left":
            twist.linear.x = abs(normalized)
            twist.angular.z = abs(normalized) * 0.35
        elif action == "strafe_right":
            twist.linear.x = abs(normalized)
            twist.angular.z = -abs(normalized) * 0.35
        elif action == "stop":
            pass

        self.cmd_pub.publish(twist)
        with self.lock:
            self.state.message = f"move {action} speed={speed:.0f}"
            self.state.lastUpdatedAt = now_iso()

    def on_odom(self, msg: Odometry) -> None:
        pos = msg.pose.pose.position
        ori = msg.pose.pose.orientation
        roll, pitch, yaw = quaternion_to_euler_deg(ori.x, ori.y, ori.z, ori.w)
        with self.lock:
            self.state.pose = Pose(pos.x, pos.y, pos.z, roll, pitch, yaw)
            self.state.simTimeSec = float(self.get_clock().now().nanoseconds) / 1_000_000_000.0
            self.state.lastUpdatedAt = now_iso()

    def on_joint_state(self, msg: JointState) -> None:
        wheel = WheelRpm()
        for name, velocity in zip(msg.name, msg.velocity):
            rpm = float(velocity) * 60.0 / (2 * math.pi)
            lower = name.lower()
            if "front" in lower and "left" in lower:
                wheel.frontLeft = rpm
            elif "front" in lower and "right" in lower:
                wheel.frontRight = rpm
            elif "rear" in lower and "left" in lower:
                wheel.rearLeft = rpm
            elif "rear" in lower and "right" in lower:
                wheel.rearRight = rpm
        with self.lock:
            self.state.wheelRpm = wheel
            self.state.lastUpdatedAt = now_iso()

    def on_image(self, msg: Image) -> None:
        frame = self.cv_bridge.imgmsg_to_cv2(msg, desired_encoding="bgr8")
        ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
        if ok:
            self.latest_jpeg = encoded.tobytes()


class GazeboProcess:
    def __init__(self, ros: RosAdapter) -> None:
        self.ros = ros
        self.process: subprocess.Popen[str] | None = None

    def start(self) -> None:
        if self.process and self.process.poll() is None:
            self.ros.update_running(True, "running", "Gazebo is already running")
            return

        ros_setup = os.getenv("ROS_SETUP", "/opt/ros/jazzy/setup.bash")
        ws_setup = os.getenv("ROVER_WS_SETUP", "$HOME/ros2_ws/install/setup.bash")
        launch = os.getenv("SIM_LAUNCH", "ros2 launch lumos_gazebo sim.launch.py")
        command = f"source {ros_setup} && source {ws_setup} && {launch}"
        self.process = subprocess.Popen(
            ["bash", "-lc", command],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            preexec_fn=os.setsid,
        )
        self.ros.update_running(True, "launching", "Gazebo launch command sent")

    def stop(self) -> None:
        if not self.process or self.process.poll() is not None:
            self.ros.update_running(False, "idle", "Gazebo is not running")
            return
        os.killpg(os.getpgid(self.process.pid), signal.SIGINT)
        self.process.wait(timeout=10)
        self.ros.update_running(False, "idle", "Gazebo stopped")


rclpy.init(args=None)
ros = RosAdapter()
gazebo = GazeboProcess(ros)
spin_thread = threading.Thread(target=rclpy.spin, args=(ros,), daemon=True)
spin_thread.start()

app = FastAPI(title="Rover Sim Bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("SIM_ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/sim/status")
def status() -> dict[str, Any]:
    return ros.snapshot()


@app.post("/api/sim/session/start")
def start_session(_body: StartRequest) -> dict[str, Any]:
    gazebo.start()
    return ros.snapshot()


@app.post("/api/sim/session/stop")
def stop_session() -> dict[str, Any]:
    gazebo.stop()
    return ros.snapshot()


@app.post("/api/sim/session/reset")
def reset_session() -> dict[str, Any]:
    gazebo.stop()
    gazebo.start()
    return ros.snapshot()


@app.post("/api/sim/move")
def move(body: MoveRequest) -> dict[str, Any]:
    ros.publish_move(body.action, body.speed)
    return ros.snapshot()


@app.post("/api/sim/command")
def command(body: CommandRequest) -> dict[str, Any]:
    if body.command == "solar_deploy":
        ros.update_running(ros.state.running, ros.state.mode, "solar_deploy command received")
    elif body.command == "camera_snapshot":
        ros.update_running(ros.state.running, ros.state.mode, "camera_snapshot command received")
    else:
        ros.update_running(ros.state.running, ros.state.mode, f"command {body.command}={body.value}")
    return ros.snapshot()


@app.get("/api/sim/events")
async def events() -> StreamingResponse:
    async def generate():
        while True:
            payload = {"type": "telemetry", **ros.snapshot()}
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.1)

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/sim/camera/stream")
async def camera_stream() -> StreamingResponse:
    async def frames():
        while True:
            jpeg = ros.latest_jpeg
            if jpeg:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
                )
            await asyncio.sleep(0.05)

    return StreamingResponse(
        frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
