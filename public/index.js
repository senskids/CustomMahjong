const socket = io();

getGirlMasCookie = function(){
    const cookies = document.cookie;
    const array = cookies.split(';');
    let girlmas_cookie = "null";  // 初期値
    array.forEach(function(value){
        const content = value.split('=');
        if(content[0] == "girlmas"){
            girlmas_cookie = content[1];
        }
    })  
    return girlmas_cookie;
}

// ログインボタンを押した時の処理
document.getElementById('login-form').addEventListener('submit', event => {
    event.preventDefault();
    // 存在すればgirlmasのuser_idを取得する
    const user_id = getGirlMasCookie();
    const user_name = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    socket.emit('login', { user_name, password, user_id });
});

// ログイン情報を受信して画面遷移  // FIXME POSTに変更する
socket.on('login-success', data => {
    document.cookie = "girlmas=" + data.user_id;
    window.location.href = `/game.html?user_id=${data.user_id}`;
    // window.location.href = '/game.html';
});    

// ログインに失敗した時の処理
socket.on('login-failed', message => {
    alert(message);
});
