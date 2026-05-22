# SIM-TO-REAL 構築メモ

## 全体構成

推奨構成は、WebアプリからROS 2へ直接つなぐのではなく、Ubuntu側に小さなHTTPブリッジを置く構成です。

```text
Rover Console Web App
  | HTTP: start/stop/reset/move/command
  | SSE: pose / wheel rpm / status
  | MJPEG: camera stream
  v
Ubuntu Sim Bridge
  | ros2 launch / ROS 2 topic pub-sub
  v
ROS 2 Jazzy + Gazebo Harmonic
  | ros_gz / ros2_control / robot_state_publisher
  v
Rover simulation model
```

この分け方にすると、ブラウザはROS 2 DDSやGazebo Transportを知らなくてよく、家のUbuntu側だけでGazebo固有の依存関係を閉じ込められます。

## 推奨バージョン

2026-05-22時点では、安定運用なら以下を推奨します。

- Ubuntu 24.04 Noble
- ROS 2 Jazzy
- Gazebo Harmonic
- `ros_gz` / `ros_gz_bridge`

ROS 2 Jazzyの公式ドキュメントではUbuntu 24.04がLinuxのTier 1対象です。またJazzyではGazebo Harmonicが推奨Gazeboリリースです。Gazebo HarmonicはUbuntu 24.04向けバイナリが提供されています。

参考:

- ROS 2 Jazzy installation: https://docs.ros.org/en/jazzy/Installation.html
- ROS 2 Jazzy release notes: https://docs.ros.org/en/iron/Releases/Release-Jazzy-Jalisco.html
- ros_gz Jazzy docs: https://docs.ros.org/en/ros2_packages/jazzy/api/ros_gz/
- Gazebo Harmonic Ubuntu install: https://gazebosim.org/docs/harmonic/install_ubuntu/

## Webアプリ側

今回追加したSIM-TO-REALタブは次のAPIを使います。

- `GET /api/sim/status`
- `GET /api/sim/events`
- `GET /api/sim/camera/stream`
- `POST /api/sim/session/start`
- `POST /api/sim/session/stop`
- `POST /api/sim/session/reset`
- `POST /api/sim/move`
- `POST /api/sim/command`

SIM-TO-REALタブの `Ubuntu Gazebo API` に、Ubuntu側ブリッジのURLを入れます。

```text
http://<ubuntu-lan-ip>:8088
```

## Ubuntu側セットアップ

1. Ubuntu 24.04を用意します。

2. ROS 2 JazzyとGazebo Harmonicをインストールします。

```bash
sudo apt update
sudo apt install curl gnupg lsb-release
sudo apt install ros-jazzy-desktop ros-jazzy-ros-gz ros-jazzy-cv-bridge
```

Gazebo HarmonicをOSRFリポジトリから入れる場合:

```bash
sudo curl https://packages.osrfoundation.org/gazebo.gpg \
  --output /usr/share/keyrings/pkgs-osrf-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/pkgs-osrf-archive-keyring.gpg] https://packages.osrfoundation.org/gazebo/ubuntu-stable $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/gazebo-stable.list > /dev/null
sudo apt update
sudo apt install gz-harmonic
```

3. ローバーのROS 2ワークスペースを作ります。

```bash
mkdir -p ~/ros2_ws/src
cd ~/ros2_ws/src
# ここにURDF/Xacro、mesh、Gazebo world、ros2_control設定を置く
cd ~/ros2_ws
rosdep install --from-paths src --ignore-src -r -y
colcon build
```

4. Gazebo起動launchを用意します。

例:

```bash
ros2 launch lumos_gazebo sim.launch.py
```

このlaunchの中で最低限起動したいもの:

- `gz sim` world
- robot description / spawn entity
- `ros_gz_bridge`
- `ros2_control` controller
- `/cmd_vel` subscriber
- `/odom`, `/joint_states`, `/camera/image_raw` publisher

5. このリポジトリの `ubuntu-sim-bridge` をUbuntuに配置して起動します。

```bash
cd ubuntu-sim-bridge
python3 -m venv .venv --system-site-packages
source .venv/bin/activate
pip install -r requirements.txt

export ROS_SETUP=/opt/ros/jazzy/setup.bash
export ROVER_WS_SETUP=$HOME/ros2_ws/install/setup.bash
export SIM_LAUNCH="ros2 launch lumos_gazebo sim.launch.py"
export SIM_CMD_VEL_TOPIC=/cmd_vel
export SIM_ODOM_TOPIC=/odom
export SIM_JOINT_TOPIC=/joint_states
export SIM_CAMERA_TOPIC=/camera/image_raw

uvicorn sim_bridge:app --host 0.0.0.0 --port 8088
```

## 最初の疎通確認

Ubuntu側:

```bash
curl http://127.0.0.1:8088/api/sim/status
curl -X POST http://127.0.0.1:8088/api/sim/session/start -H 'content-type: application/json' -d '{}'
curl -X POST http://127.0.0.1:8088/api/sim/move -H 'content-type: application/json' -d '{"action":"forward","speed":30}'
```

Webアプリ側:

1. SIM-TO-REALタブを開く。
2. `Ubuntu Gazebo API` に `http://<ubuntu-lan-ip>:8088` を入れる。
3. `Start` を押す。
4. W/A/S/D/Q/E/Space または画面ボタンで操作する。
5. 姿勢、タイヤRPM、カメラが更新されることを確認する。

## セキュリティ

このAPIはUbuntu上でプロセスを起動できるため、公開インターネットに直接出さないでください。家の外から使うならVPNを推奨します。

- LAN内だけ: Ubuntu firewallでポート8088を自宅LANに限定
- 外部アクセス: Tailscale / WireGuard
- 本番運用: HTTPS reverse proxy + token認証 + CORS許可元固定

## 実機とのSIM-TO-REAL化

最初はWeb UIとGazeboを一致させ、次に実機の制御APIと同じコマンド形に寄せます。

1. Web UIの操作コマンドを `action + speed` に統一する。
2. Gazebo側は `/cmd_vel` またはホイール速度topicに変換する。
3. 実機側は既存CAN/UDPコマンドに変換する。
4. 姿勢、RPM、カメラの戻り値スキーマを実機とシミュレーションで同じにする。
5. UIは接続先を `OPERATION` と `SIM-TO-REAL` で切り替えるだけにする。
