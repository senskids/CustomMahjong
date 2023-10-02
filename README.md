# カスタム麻雀（仮）
色々なルールの麻雀が遊べるWebアプリ

## Library & Service
- node js
- express
- socket.io
- @kobalab/majiang-core
- いらすとや
- Render

## For test play
1. git clone XXXXX
2. npm install 
3. npm run start

## For developer
#### [ブランチの基本ルール](https://zenn.dev/kazunori_kimura/articles/e7b75e60316ded6480a6)
#### 機能実装前
1. Github 実装する内容をISSUEに建てる
2. Local ```git checkout develop```
3. Local ```git pull origin develop```
4. Local ```git checkout -b feature/#(ISSUE番号)/(ISSUEの簡潔な内容)```
5. この状態で機能実装
#### 機能実装後
6. Local 機能実装してcommit -m "#(ISSUE番号):コミットメッセージ"
7. Local ```git checkout develop```
8. Local ```git pull origin develop```
9. Local ```git checkout feature/#(ISSUE番号)/(ISSUEの簡潔な内容)```
10. Local ```git rebase develop```
11. Local ```git push origin feature/#(ISSUE番号)/(ISSUEの簡潔な内容)```  無理な場合は-f
12. Github feature/#(ISSUE番号)/(ISSUEの簡潔な内容) => developへのPull requestを作成
13. Github チェック後、マージ、originのfeature/#(ISSUE番号)/(ISSUEの簡潔な内容)ブランチを削除
14. Github ISSUEをクローズする
15. Local ```git checkout develop```
16. Local ```git fetch --prune```
17. Local ```git pull origin develop```
18. Local ```git branch -D feature/#(ISSUE番号)/(ISSUEの簡潔な内容)```
19. 1に戻る
