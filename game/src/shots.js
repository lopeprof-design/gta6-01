// Deterministic screenshot setups: ?shot=drive|chase|mission|street&seed=1
// skips the start screen and stages a fixed scene so every screenshot run
// shows the same moment — the same street, the same chase, the same beacon.
export function applyShotMode(game, params) {
  const mode = params.get('shot') || 'drive';
  game.startGame({ fromShot: true });

  if (mode === 'drive') {
    // Mara in her car on the main north-south avenue, traffic rolling by.
    const car = game.spawnPlayerCar(0, -60, Math.PI);
    game.forceEnterCar(car);
    game.shotAutoDrive = true;
    game.setCameraOrbit(Math.PI, 0.32, 11);
  } else if (mode === 'chase') {
    // Wanted 3: cruisers closing in from behind on the same avenue.
    const car = game.spawnPlayerCar(0, -40, Math.PI);
    game.forceEnterCar(car);
    game.setWanted(3);
    game.shotAutoDrive = true;
    game.setCameraOrbit(Math.PI, 0.3, 12);
  } else if (mode === 'mission') {
    // On foot at the pier, the First Fare beacon glowing at the far end.
    game.teleportPlayer(0, 204, 0);
    game.missions.jumpTo(0);
    game.setCameraOrbit(Math.PI, 0.34, 8);
  } else if (mode === 'street') {
    // A busy stretch of the main avenue: traffic rolling past, pedestrians
    // on the sidewalks, towers on both sides. Stage a few of each nearby so
    // the frame is busy the moment it is taken.
    game.teleportPlayer(3, 36, 2.6);
    game.missions.jumpTo(1);
    game.traffic.cars.slice(0, 4).forEach((c, i) => {
      c.axis = 'z';
      c.street = 0;
      c.dir = i % 2 === 0 ? 1 : -1;
      c.x = 2.6 * c.dir;
      c.z = 8 + i * 11;
      c.lastBlock = Math.floor(c.z / 40);
      c.speed = c.cruise;
    });
    game.peds.list.slice(0, 5).forEach((p, i) => {
      p.axis = 'z';
      p.street = 0;
      p.x = i % 2 === 0 ? 6.6 : -6.6;
      p.z = 22 + i * 7;
      p.dir = i % 2 === 0 ? 1 : -1;
      p.state = 'walk';
    });
    game.setCameraOrbit(2.6, 0.38, 10);
  }
  game.state.shot = mode;
}
