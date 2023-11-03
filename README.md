# カスタム麻雀（仮）
色々なルールの麻雀が遊べるWebアプリ

## Library & Service
- <a href="https://nodejs.org/en">node js</a>
- <a href="https://expressjs.com/ja/">express</a>
- <a href="https://socket.io/">socket.io</a>
- <a href="https://github.com/kobalab/majiang-core">@kobalab/majiang-core</a>
- <a href="https://www.irasutoya.com/">いらすとや</a>
- <a href="https://render.com/">Render</a>
- <a href="https://dova-s.jp/bgm/play18674.html">DOVA-SYNDROME</a>

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
6. Local 機能実装して ```git commit -m "#(ISSUE番号):コミットメッセージ"```
7. Local ```git checkout develop```
8. Local ```git pull origin develop```
9. Local ```git checkout feature/#(ISSUE番号)/(ISSUEの簡潔な内容)```
10. Local ```git rebase develop```
11. Local ```git push origin feature/#(ISSUE番号)/(ISSUEの簡潔な内容)```  無理な場合は-f
13. Github feature/#(ISSUE番号)/(ISSUEの簡潔な内容) => developへのPull requestを作成
14. Github 作成したPull requestのDevelopmentからISSUEとの紐づけを実施
15. Github チェック後、マージ、originのfeature/#(ISSUE番号)/(ISSUEの簡潔な内容)ブランチを削除
16. Github ISSUEをクローズする
17. Local ```git checkout develop```
18. Local ```git fetch --prune```
19. Local ```git pull origin develop```
20. Local ```git branch -D feature/#(ISSUE番号)/(ISSUEの簡潔な内容)```
21. 1に戻る
