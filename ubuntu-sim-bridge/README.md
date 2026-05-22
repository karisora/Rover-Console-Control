# Ubuntu Sim Bridge

This is a starter bridge for the SIM-TO-REAL tab. Run it on the Ubuntu desktop
that owns the ROS 2 / Gazebo environment. The web console talks to this process
over HTTP and SSE; this process talks to ROS 2 topics and launches Gazebo.

## Recommended stack

- Ubuntu 24.04
- ROS 2 Jazzy
- Gazebo Harmonic
- `ros_gz` / `ros_gz_bridge`

ROS 2 Jazzy targets Ubuntu 24.04 as a Tier 1 Linux platform, and Jazzy's
recommended Gazebo release is Harmonic. Gazebo Harmonic binaries are available
for Ubuntu 24.04.

## API contract used by the web app

- `GET /api/sim/status`
- `GET /api/sim/events` as Server-Sent Events
- `GET /api/sim/camera/stream` as MJPEG
- `POST /api/sim/session/start`
- `POST /api/sim/session/stop`
- `POST /api/sim/session/reset`
- `POST /api/sim/move`
- `POST /api/sim/command`

Example move payload:

```json
{ "action": "forward", "speed": 40 }
```

`action` is one of `forward`, `backward`, `rotate_left`, `rotate_right`,
`strafe_left`, `strafe_right`, or `stop`. In this rover's current UI, strafe is
treated as a differential veer command.

## Install

```bash
sudo apt update
sudo apt install python3-venv python3-pip ros-jazzy-cv-bridge ros-jazzy-ros-gz

cd ubuntu-sim-bridge
python3 -m venv .venv --system-site-packages
source .venv/bin/activate
pip install -r requirements.txt
```

## Configure

Set these environment variables for your rover workspace:

```bash
export ROS_SETUP=/opt/ros/jazzy/setup.bash
export ROVER_WS_SETUP=$HOME/ros2_ws/install/setup.bash
export SIM_LAUNCH="ros2 launch lumos_gazebo sim.launch.py"
export SIM_CMD_VEL_TOPIC=/cmd_vel
export SIM_ODOM_TOPIC=/odom
export SIM_JOINT_TOPIC=/joint_states
export SIM_CAMERA_TOPIC=/camera/image_raw
```

If your Gazebo model receives wheel commands instead of `/cmd_vel`, keep this
bridge as the HTTP layer and replace `RosAdapter.publish_move()` with your
controller-specific command publisher.

## Run

```bash
source /opt/ros/jazzy/setup.bash
source ~/ros2_ws/install/setup.bash
uvicorn sim_bridge:app --host 0.0.0.0 --port 8088
```

Then set the SIM-TO-REAL tab's Ubuntu Gazebo API URL to:

```text
http://<ubuntu-lan-ip>:8088
```

For access outside your home LAN, put this behind a VPN such as Tailscale or
WireGuard. Avoid exposing this API directly to the public internet because it can
start processes on your Ubuntu machine.
