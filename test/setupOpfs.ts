// このファイルを編集する事を禁止します。
import "opfs-mock"
/*
　JestでのOPFSモックのセットアップの方法は以下を参照してください。
    https://github.com/jurerotar/opfs-mock?tab=readme-ov-file#jest
  動作はESM専用であり、このプロジェクトではESM対応を必須とします。

  "opfs-mock"に登録したデータはテスト間で共有されるため、
  各テストの後にOPFSをクリアする必要があります。
  クリアの方法は以下の通りです:
  ```
  import { resetMockOPFS } from 'opfs-mock'

    beforeEach(() => {
    resetMockOPFS();
    });
  ```
    これにより、各テストがクリーンなOPFS状態で開始され、テスト間の干渉を防止します。
    
*/