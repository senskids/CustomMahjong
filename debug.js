exports.createTenhoTiles = function(){
    let tiles = [...Array(136)].map((_, i) => i);
    tiles[13] = 134;
    tiles[134] = 13;
    return tiles;
}