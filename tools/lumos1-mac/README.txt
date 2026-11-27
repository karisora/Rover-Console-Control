LUMOS-1 Rover Console — Mac パッケージ
=======================================

起動方法
--------
macOS と Node.js 18 以上が必要です。
Finder で start.command または LumOS1-Console.app をダブルクリックしてください。
start.command は Terminal でブリッジを実行し、.app はバックグラウンドで実行します。

起動すると既定のブラウザでコンソールを開きます。通常は http://127.0.0.1:5050/
です。5050 が使用中の場合は 5051～5055 の空きポートが選ばれます。
画面とブリッジは同じ URL で動作するため、通常は BRIDGE URL の設定は不要です。
3D モデルと反射照明データは同梱されており、インターネット接続なしで表示できます。

実機を操作する場合は、Mac をローバーの Wi-Fi AP (LumOS1-Pico2W) に接続してから
起動してください。実機への通信を避けて画面を確認する場合は、次のコマンドで
ブリッジの通信先を Mac 内に切り替えて起動できます。

  ROVER_HOST=127.0.0.1 ./start.command

停止方法
--------
画面の SHUTDOWN ボタンでブリッジを停止できます。
start.command から新しく起動した場合は、Terminal で Ctrl+C でも停止できます。

ログ
----
.app から起動した場合のログは ~/Library/Logs/LumOS1-Console/bridge.log です。

ソースからの再ビルド
--------------------
React/TypeScript のソースを含むリポジトリのルートで実行してください。

  pnpm install --frozen-lockfile --ignore-scripts
  ./tools/package-mac.sh

出力先は dist-mac/lumos1-console-mac/ です。

3D 表示の反射照明
-----------------
Empty Warehouse 01 (Poly Haven、CC0)
https://polyhaven.com/a/empty_warehouse_01
