import React, { useCallback, useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const W = 1280;
const H = 720;

const LEVELS = [
  {
    level: 1,
    rows: 4,
    cols: 8,
    gapX: 108,
    rowGap: 72,
    enemyFireInterval: 0.80,
    enemyBulletMinSpeed: 260,
    enemyBulletMaxSpeed: 340,
    formationSpeed: 0,
  },
  {
    level: 2,
    rows: 4,
    cols: 9,
    gapX: 102,
    rowGap: 70,
    enemyFireInterval: 0.70,
    enemyBulletMinSpeed: 280,
    enemyBulletMaxSpeed: 370,
    formationSpeed: 25,
  },
  {
    level: 3,
    rows: 5,
    cols: 9,
    gapX: 102,
    rowGap: 62,
    enemyFireInterval: 0.62,
    enemyBulletMinSpeed: 300,
    enemyBulletMaxSpeed: 400,
    formationSpeed: 40,
  },
  {
    level: 4,
    rows: 5,
    cols: 10,
    gapX: 94,
    rowGap: 60,
    enemyFireInterval: 0.54,
    enemyBulletMinSpeed: 320,
    enemyBulletMaxSpeed: 430,
    formationSpeed: 58,
  },
  {
    level: 5,
    rows: 6,
    cols: 10,
    gapX: 94,
    rowGap: 55,
    enemyFireInterval: 0.46,
    enemyBulletMinSpeed: 340,
    enemyBulletMaxSpeed: 460,
    formationSpeed: 78,
  },
  {
    level: 6,
    rows: 6,
    cols: 11,
    gapX: 88,
    rowGap: 53,
    enemyFireInterval: 0.38,
    enemyBulletMinSpeed: 370,
    enemyBulletMaxSpeed: 500,
    formationSpeed: 105,
  },
];

function createEnemiesForLevel(levelNumber) {
  const levelData = LEVELS[levelNumber - 1];
  const enemies = [];

  if (!levelData) return enemies;

  const startX = W / 2 - ((levelData.cols - 1) * levelData.gapX) / 2;

  for (let row = 0; row < levelData.rows; row++) {
    for (let col = 0; col < levelData.cols; col++) {
      enemies.push({
        x: startX + col * levelData.gapX,
        y: 140 + row * levelData.rowGap,
        baseX: startX + col * levelData.gapX,
        baseY: 140 + row * levelData.rowGap,
        width: 42,
        height: 34,
        row,
        col,
      });
    }
  }

  return enemies;
}

function getRandomGiftTrigger(enemyCount) {
  // The gift appears once per level when a random number of enemies remain.
  // Keep at least one enemy alive so the gift never appears immediately.
  if (enemyCount <= 1) return 1;
  return Math.floor(Math.random() * (enemyCount - 1)) + 1;
}

function createGift(game) {
  if (!game || game.giftSpawned || game.enemies.length === 0) return;

  const enemy =
    game.enemies[Math.floor(Math.random() * game.enemies.length)];

  game.giftSpawned = true;
  game.gift = {
    x: enemy.x,
    y: enemy.y + 18,
    width: 26,
    height: 26,
    speed: 150,
    rotation: 0,
  };
}

function App() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const keysRef = useRef({});
  const gameRef = useRef(null);
  const bgMusicRef = useRef(null);
  const killSoundRef = useRef(null);
  const touchRef = useRef({ active: false, x: W / 2 });

  const [screen, setScreen] = useState("start");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(6);
  const [level, setLevel] = useState(1);
  const [playerName, setPlayerName] = useState("");
  const [savedScore, setSavedScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const loadScores = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/scores?limit=10`);
      if (!response.ok) throw new Error("Could not load scores");
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.warn("Leaderboard unavailable:", error.message);
    }
  }, []);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  const playMusic = useCallback(() => {
    const audio = bgMusicRef.current;
    if (!audio) return;
    audio.volume = 0.28;
    audio.play().catch(() => {
      // Browsers require a user gesture before audio can play.
    });
  }, []);

  const pauseMusic = useCallback(() => {
    if (bgMusicRef.current) bgMusicRef.current.pause();
  }, []);

  const playKillSound = useCallback(() => {
    const audio = killSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 0.55;
    audio.play().catch(() => {});
  }, []);

  const saveScore = async () => {
    const name = playerName.trim();
    if (!name || savedScore) return;

    try {
      const response = await fetch(`${API_URL}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Could not save score");
      }

      setSavedScore(true);
      await loadScores();
    } catch (error) {
      alert(`Could not save score: ${error.message}`);
    }
  };

  const newGame = useCallback(() => {
    touchRef.current.active = false;

    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.7 + 0.3,
      speed: Math.random() * 18 + 5,
      alpha: Math.random() * 0.7 + 0.2,
    }));

    gameRef.current = {
      running: true,
      paused: false,
      score: 0,
      lives: 6,
      level: 1,
      levelMessageTimer: 0,
      levelCleared: false,
      formationOffset: 0,
      shooterCount: 1,
      giftSpawned: false,
      giftCollected: false,
      gift: null,
      giftTriggerRemaining: getRandomGiftTrigger(createEnemiesForLevel(1).length),
      formationDirection: 1,
      formationTime: 0,
      player: {
        x: W / 2,
        y: H - 72,
        width: 34,
        height: 40,
        speed: 470,
        invulnerable: 0,
      },
      stars,
      bullets: [],
      enemyBullets: [],
      enemies: createEnemiesForLevel(1),
      particles: [],
      autoFireTimer: 0,
      enemyFireTimer: 0,
      shake: 0,
    };

    setScore(0);
    setLives(3);
    setLevel(1);
    setSavedScore(false);
    setScreen("playing");
    setLeaderboardOpen(false);
    playMusic();
  }, [playMusic]);

  const finishGame = useCallback(
    (win) => {
      const game = gameRef.current;
      if (!game) return;

      touchRef.current.active = false;
      game.running = false;
      game.paused = false;
      setScore(game.score);
      setLives(game.lives);
      setScreen(win ? "win" : "gameover");
      pauseMusic();
    },
    [pauseMusic],
  );

  const startNextLevel = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;

    const nextLevel = game.level + 1;

    if (nextLevel > LEVELS.length) {
      finishGame(true);
      return;
    }

    game.level = nextLevel;
    game.enemies = createEnemiesForLevel(nextLevel);
    game.giftSpawned = false;
    game.giftCollected = false;
    game.gift = null;
    game.giftTriggerRemaining = getRandomGiftTrigger(game.enemies.length);
    game.bullets = [];
    game.enemyBullets = [];
    game.autoFireTimer = 0;
    game.enemyFireTimer = 0;
    game.formationOffset = 0;
    game.formationDirection = 1;
    game.formationTime = 0;
    game.levelMessageTimer = 0;
    game.levelCleared = false;

    setLevel(nextLevel);
  }, [finishGame]);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game || screen !== "playing") return;

    game.paused = !game.paused;
    if (game.paused) pauseMusic();
    else playMusic();

    setScreen(game.paused ? "menu" : "playing");
  }, [pauseMusic, playMusic, screen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      keysRef.current[event.key] = true;

      if (event.code === "Space") {
        event.preventDefault();
        if (screen === "playing" || screen === "menu") togglePause();
      }

      if (
        event.key === "Enter" &&
        (screen === "start" || screen === "gameover" || screen === "win")
      ) {
        newGame();
      }
    };

    const onKeyUp = (event) => {
      keysRef.current[event.key] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [newGame, screen, togglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    function hit(a, b) {
      return (
        Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
        Math.abs(a.y - b.y) < (a.height + b.height) / 2
      );
    }

    function explode(game, x, y) {
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 170 + 50;
        game.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.45 + Math.random() * 0.35,
          maxLife: 0.8,
          size: Math.random() * 3 + 1,
        });
      }
    }

    function update(game, dt) {
      if (!game || !game.running || game.paused) return;

      if (game.levelMessageTimer > 0) {
        game.levelMessageTimer -= dt;

        if (game.levelMessageTimer <= 0 && game.levelCleared) {
          startNextLevel();
        }

        return;
      }

      const keys = keysRef.current;
      let direction = 0;
      if (keys.ArrowLeft || keys.a || keys.A) direction -= 1;
      if (keys.ArrowRight || keys.d || keys.D) direction += 1;

      if (touchRef.current.active) {
        // Touch controls are only used while a finger is on the game.
        // Desktop keyboard/mouse behavior remains unchanged.
        const targetX = touchRef.current.x;
        const difference = targetX - game.player.x;
        const touchStep = game.player.speed * 1.35 * dt;

        if (Math.abs(difference) <= touchStep) {
          game.player.x = targetX;
        } else {
          game.player.x += Math.sign(difference) * touchStep;
        }
      } else {
        game.player.x += direction * game.player.speed * dt;
      }

      game.player.x = Math.max(28, Math.min(W - 28, game.player.x));

      if (game.player.invulnerable > 0) game.player.invulnerable -= dt;
      if (game.shake > 0) game.shake -= dt;

      const levelData = LEVELS[game.level - 1];

      if (levelData?.formationSpeed > 0 && game.enemies.length) {
        game.formationTime += dt;

        game.formationOffset +=
          game.formationDirection * levelData.formationSpeed * dt;

        const formationLimit = 360 - ((levelData.cols - 1) * levelData.gapX) / 2;

        if (Math.abs(game.formationOffset) >= formationLimit) {
          game.formationDirection *= -1;
          game.formationOffset =
            Math.max(-formationLimit, Math.min(formationLimit, game.formationOffset));
        }

        for (const enemy of game.enemies) {
          enemy.x = enemy.baseX + game.formationOffset;
          enemy.y = enemy.baseY + Math.sin(game.formationTime * 1.5) * 4;
        }
      }

      game.autoFireTimer += dt;
      if (game.autoFireTimer >= 0.32) {
        game.autoFireTimer = 0;

        const shooterCount = Math.max(1, game.shooterCount || 1);
        const spread = 16;

        for (let shooter = 0; shooter < shooterCount; shooter++) {
          const offset = (shooter - (shooterCount - 1) / 2) * spread;

          game.bullets.push({
            x: game.player.x + offset,
            y: game.player.y - 22,
            width: 4,
            height: 18,
            speed: 720,
          });
        }
      }

      game.enemyFireTimer += dt;
      if (game.enemyFireTimer >= levelData.enemyFireInterval) {
        game.enemyFireTimer = 0;
        if (game.enemies.length) {
          const enemy =
            game.enemies[Math.floor(Math.random() * game.enemies.length)];
          game.enemyBullets.push({
            x: enemy.x,
            y: enemy.y + 20,
            radius: 5,
            speed:
              levelData.enemyBulletMinSpeed +
              Math.random() *
                (levelData.enemyBulletMaxSpeed -
                  levelData.enemyBulletMinSpeed),
          });
        }
      }

      for (const star of game.stars) {
        star.y += star.speed * dt;
        if (star.y > H) {
          star.y = 0;
          star.x = Math.random() * W;
        }
      }

      for (let i = game.bullets.length - 1; i >= 0; i--) {
        const bullet = game.bullets[i];
        bullet.y -= bullet.speed * dt;

        if (bullet.y < -30) {
          game.bullets.splice(i, 1);
          continue;
        }

        let destroyed = false;
        for (let j = game.enemies.length - 1; j >= 0; j--) {
          const enemy = game.enemies[j];
          if (
            hit(
              {
                x: bullet.x,
                y: bullet.y,
                width: bullet.width,
                height: bullet.height,
              },
              enemy,
            )
          ) {
            game.enemies.splice(j, 1);
            game.bullets.splice(i, 1);
            game.score += 100;
            setScore(game.score);
            explode(game, enemy.x, enemy.y);
            playKillSound();

            // One gift per level. Its trigger is randomized at level start.
            if (!game.giftSpawned && game.enemies.length <= game.giftTriggerRemaining) {
              createGift(game);
            }

            destroyed = true;
            break;
          }
        }

        if (destroyed && game.enemies.length === 0) {
          if (game.level >= LEVELS.length) {
            finishGame(true);
            return;
          }

          game.levelCleared = true;
          game.levelMessageTimer = 1.8;
          return;
        }
      }

      // Gift pickup: the gift falls toward the player. It can only appear once
      // in each level and increases the number of simultaneous shooters.
      if (game.gift) {
        game.gift.y += game.gift.speed * dt;
        game.gift.rotation += dt * 4;

        if (
          Math.abs(game.gift.x - game.player.x) < 30 &&
          Math.abs(game.gift.y - game.player.y) < 34
        ) {
          game.gift = null;
          game.giftCollected = true;
          game.shooterCount += 1;
          explode(game, game.player.x, game.player.y - 10);
        } else if (game.gift.y > H + 40) {
          game.gift = null;
        }
      }

      for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = game.enemyBullets[i];
        bullet.y += bullet.speed * dt;

        if (bullet.y > H + 20) {
          game.enemyBullets.splice(i, 1);
          continue;
        }

        if (
          Math.hypot(bullet.x - game.player.x, bullet.y - game.player.y) < 24 &&
          game.player.invulnerable <= 0
        ) {
          game.enemyBullets.splice(i, 1);
          game.lives -= 1;
          game.shooterCount = Math.max(1, game.shooterCount - 1);
          setLives(game.lives);
          game.player.invulnerable = 1.3;
          game.shake = 0.35;
          explode(game, game.player.x, game.player.y);

          if (game.lives <= 0) {
            finishGame(false);
            return;
          }
        }
      }

      for (let i = game.particles.length - 1; i >= 0; i--) {
        const particle = game.particles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.97;
        particle.vy *= 0.97;
        particle.life -= dt;
        if (particle.life <= 0) game.particles.splice(i, 1);
      }
    }

    function draw(game) {
      ctx.clearRect(0, 0, W, H);

      const gradient = ctx.createRadialGradient(
        W * 0.55,
        H * 0.25,
        20,
        W * 0.55,
        H * 0.35,
        H * 0.8,
      );
      gradient.addColorStop(0, "#16104e");
      gradient.addColorStop(0.45, "#080c35");
      gradient.addColorStop(1, "#010208");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      const nebula = [
        [W * 0.25, H * 0.2, 180, "rgba(75,35,210,.13)"],
        [W * 0.72, H * 0.28, 240, "rgba(130,30,220,.12)"],
        [W * 0.55, H * 0.72, 190, "rgba(30,55,220,.10)"],
      ];

      for (const [x, y, r, color] of nebula) {
        const ng = ctx.createRadialGradient(x, y, 0, x, y, r);
        ng.addColorStop(0, color);
        ng.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ng;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      for (const star of game?.stars || []) {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#a99cff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "white";
      ctx.font = "bold 28px 'Share Tech Mono', Consolas, monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `SCORE ${String(game?.score || 0).padStart(4, "0")}`,
        28,
        40,
      );

      ctx.fillStyle = "#ff5a68";
      ctx.fillText(`♥ ${game?.lives ?? 3}`, 250, 40);

      ctx.fillStyle = "#62e6ff";
      ctx.fillText(`SHOOTERS ${game?.shooterCount ?? 1}`, 340, 40);

      ctx.fillStyle = "#9f94ff";
      ctx.textAlign = "center";
      ctx.font = "bold 22px 'Share Tech Mono', Consolas, monospace";
      ctx.fillText(`LEVEL ${game?.level ?? 1}`, W / 2, 38);

      ctx.fillStyle = "#ddd9ff";
      ctx.font = "18px 'Share Tech Mono', Consolas, monospace";
      ctx.textAlign = "right";
      ctx.fillText("PRESS SPACE FOR MENU", W - 28, 34);

      if (!game) return;

      ctx.save();

      if (game.shake > 0) {
        ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
      }

      for (const enemy of game.enemies) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.shadowBlur = 12;
        ctx.shadowColor = enemy.row % 2 ? "#ff356d" : "#ff5b35";

        ctx.fillStyle = enemy.row % 2 ? "#f5f5ff" : "#ffe7e7";
        ctx.beginPath();
        ctx.arc(0, -3, 13, Math.PI, 0);
        ctx.lineTo(15, 12);
        ctx.lineTo(7, 8);
        ctx.lineTo(0, 15);
        ctx.lineTo(-7, 8);
        ctx.lineTo(-15, 12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#e73333";
        ctx.fillRect(-11, 0, 22, 11);

        ctx.fillStyle = "#15152a";
        ctx.fillRect(-7, -5, 4, 4);
        ctx.fillRect(3, -5, 4, 4);
        ctx.restore();
      }

      // Falling gift / power-up
      if (game.gift) {
        ctx.save();
        ctx.translate(game.gift.x, game.gift.y);
        ctx.rotate(game.gift.rotation);

        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ffd84d";
        ctx.fillStyle = "#ffd84d";
        ctx.fillRect(-11, -11, 22, 22);

        ctx.fillStyle = "#fff4a8";
        ctx.fillRect(-3, -11, 6, 22);
        ctx.fillRect(-11, -3, 22, 6);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(-11, -11, 22, 22);
        ctx.restore();
      }

      for (const bullet of game.bullets) {
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#ffffff";
        ctx.fillStyle = "#fff";
        ctx.fillRect(
          bullet.x - 2,
          bullet.y - bullet.height / 2,
          bullet.width,
          bullet.height,
        );
        ctx.restore();
      }

      for (const bullet of game.enemyBullets) {
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#ff1600";
        ctx.fillStyle = "#ff2c14";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const particle of game.particles) {
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        ctx.fillStyle = "#ffb347";
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.globalAlpha = 1;

      const player = game.player;
      if (
        player.invulnerable <= 0 ||
        Math.floor(player.invulnerable * 12) % 2 === 0
      ) {
        ctx.save();
        ctx.translate(player.x, player.y);

        // Draw the jet's extra weapon barrels so the power-up is visible.
        const shooterCount = Math.max(1, game.shooterCount || 1);
        const barrelSpread = 16;

        ctx.shadowBlur = 12;
        ctx.shadowColor = "#69d7ff";
        ctx.strokeStyle = "#dce9ff";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        for (let shooter = 0; shooter < shooterCount; shooter++) {
          const offset = (shooter - (shooterCount - 1) / 2) * barrelSpread;
          ctx.beginPath();
          ctx.moveTo(offset, 1);
          ctx.lineTo(offset, -15);
          ctx.stroke();
        }

        ctx.shadowBlur = 18;
        ctx.shadowColor = "#69d7ff";

        ctx.fillStyle = "#dce9ff";
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(19, 17);
        ctx.lineTo(7, 13);
        ctx.lineTo(0, 22);
        ctx.lineTo(-7, 13);
        ctx.lineTo(-19, 17);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#5264ff";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(8, 7);
        ctx.lineTo(0, 4);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ff4d4d";
        ctx.fillStyle = "#ff513f";
        ctx.beginPath();
        ctx.moveTo(-7, 16);
        ctx.lineTo(0, 31);
        ctx.lineTo(7, 16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (game.levelMessageTimer > 0 && game.levelCleared) {
        ctx.save();

        ctx.fillStyle = "rgba(0, 0, 20, 0.68)";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#8c7dff";

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 46px 'Share Tech Mono', Consolas, monospace";
        ctx.fillText(`LEVEL ${game.level} COMPLETE`, W / 2, H / 2 - 20);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#aaa6c8";
        ctx.font = "20px 'Share Tech Mono', Consolas, monospace";
        ctx.fillText(`NEXT LEVEL ${game.level + 1}`, W / 2, H / 2 + 25);

        ctx.restore();
      }

      ctx.restore();
    }

    let lastTime = performance.now();

    function loop(time) {
      const dt = Math.min((time - lastTime) / 1000 || 0, 0.033);
      lastTime = time;
      update(gameRef.current, dt);
      draw(gameRef.current);
      animationRef.current = requestAnimationFrame(loop);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animationRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [finishGame, playKillSound, startNextLevel]);

  const closeMenu = () => {
    const game = gameRef.current;
    if (!game) return;
    touchRef.current.active = false;
    game.paused = false;
    setScreen("playing");
    playMusic();
  };

  const showEndLeaderboard = () => {
    setLeaderboardOpen((value) => !value);
    if (!leaderboardOpen) loadScores();
  };

  const updateTouchPosition = useCallback((clientX) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    // Convert the phone/tablet screen position into the game's fixed 1280px world.
    const x = ((clientX - rect.left) / rect.width) * W;
    touchRef.current.x = Math.max(28, Math.min(W - 28, x));
  }, []);

  const handlePointerDown = useCallback(
    (event) => {
      if (event.pointerType !== "touch") return;
      if (screen !== "playing") return;

      event.preventDefault();
      touchRef.current.active = true;
      updateTouchPosition(event.clientX);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [screen, updateTouchPosition],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (event.pointerType !== "touch") return;
      if (!touchRef.current.active) return;

      event.preventDefault();
      updateTouchPosition(event.clientX);
    },
    [updateTouchPosition],
  );

  const handlePointerEnd = useCallback((event) => {
    if (event.pointerType !== "touch") return;
    touchRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  return (
    <div className="app">
      <audio ref={bgMusicRef} src="/audio/bg-music.wav" loop preload="auto" />
      <audio ref={killSoundRef} src="/audio/kill.wav" preload="auto" />

      <div className="game-shell">
        <canvas ref={canvasRef} />

        {screen === "start" && (
          <div className="overlay">
            <div className="panel">
              <h1>SPACE SHOOTER</h1>
              <p>Destroy the alien formation.</p>
              <button onClick={newGame}>START GAME</button>
              <button
                className="secondary"
                onClick={() => {
                  setLeaderboardOpen(true);
                  loadScores();
                }}
              >
                LEADERBOARD
              </button>
              <small>A / D or ← / → to move · Auto fire · Collect gifts for extra shooters</small>
            </div>
          </div>
        )}

        {screen === "menu" && (
          <div className="overlay">
            <div className="panel">
              <h1>SPACE SHOOTER</h1>
              <button onClick={closeMenu}>RESUME</button>
              <button onClick={newGame}>RESTART</button>
              <button
                className="secondary"
                onClick={() => {
                  setLeaderboardOpen(true);
                  loadScores();
                }}
              >
                LEADERBOARD
              </button>
            </div>
          </div>
        )}

        {(screen === "gameover" || screen === "win") && (
          <div className="overlay">
            <div className="panel end-panel">
              <h1>{screen === "win" ? "YOU WIN!" : "GAME OVER"}</h1>
              <p className="final-score">SCORE {score}</p>

              {!savedScore ? (
                <>
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveScore();
                    }}
                    maxLength={20}
                    placeholder="Enter player name"
                    autoFocus
                  />
                  <button onClick={saveScore} disabled={!playerName.trim()}>
                    SAVE SCORE
                  </button>
                </>
              ) : (
                <p className="saved">✓ Score saved!</p>
              )}

              <button onClick={newGame}>PLAY AGAIN</button>
              <button className="secondary" onClick={showEndLeaderboard}>
                {leaderboardOpen ? "HIDE LEADERBOARD" : "LEADERBOARD"}
              </button>

              {leaderboardOpen && <Leaderboard scores={leaderboard} />}
            </div>
          </div>
        )}

        {leaderboardOpen && (screen === "start" || screen === "menu") && (
          <div className="leaderboard-modal overlay">
            <div className="panel leaderboard-panel">
              <h1>LEADERBOARD</h1>

              <Leaderboard scores={leaderboard} />

              <button onClick={() => setLeaderboardOpen(false)}>CLOSE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Leaderboard({ scores }) {
  return (
    <div className="leaderboard">
      {scores.length === 0 ? (
        <p className="empty">No scores yet.</p>
      ) : (
        <div className="score-list">
          <div className="score-row header">
            <span>#</span>
            <span>PLAYER</span>
            <span>SCORE</span>
            <span>DATE / TIME</span>
          </div>

          {scores.map((item, index) => (
            <div className="score-row" key={item._id}>
              <span>{index + 1}</span>
              <span>{item.name}</span>
              <strong>{item.score}</strong>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
