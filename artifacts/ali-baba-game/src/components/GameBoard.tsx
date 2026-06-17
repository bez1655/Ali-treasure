import { useEffect, useRef, useState } from "react";
import { motion, animate } from "framer-motion";
import type { GamePlayer } from "@/contexts/SocketContext";

const CELL_POSITIONS: [number, number][] = [
  [0, 0],
  [50, 90], [43, 90], [36, 90], [14, 90], [21, 90],
  [14, 84], [14, 78], [21, 81], [14, 74], [21, 75],
  [14, 68], [14, 62], [21, 62], [28, 62], [35, 59],
  [29, 55], [36, 55], [36, 50], [28, 47], [36, 44],
  [43, 44], [50, 44], [52, 47], [50, 51], [41, 55],
  [45, 60], [51, 63], [44, 63], [57, 50], [59, 56],
  [61, 63], [62, 63], [63, 63], [66, 60], [68, 63],
  [69, 63], [72, 60], [75, 63], [77, 63], [79, 70],
  [77, 75], [76, 78], [68, 38], [61, 35], [54, 32],
  [47, 30], [14, 33], [20, 29], [27, 27], [33, 25],
  [39, 27], [45, 29], [51, 31], [53, 32], [59, 28],
  [63, 24], [70, 19], [76, 16], [81, 13], [86, 11],
];

const TOKEN_SIZE = 26;
const STEP_MS = 160;
const BASE_PATH = import.meta.env.BASE_URL;

function cellXY(cell: number, bw: number, bh: number, offsetIdx: number) {
  const pos = CELL_POSITIONS[Math.max(1, Math.min(60, cell))] ?? CELL_POSITIONS[1];
  return {
    x: (pos[0] / 100) * bw + offsetIdx * 7 - TOKEN_SIZE / 2,
    y: (pos[1] / 100) * bh + offsetIdx * 7 - TOKEN_SIZE / 2,
  };
}

interface TokenProps {
  player: GamePlayer;
  boardW: number;
  boardH: number;
  offsetIdx: number;
}

function PlayerToken({ player, boardW, boardH, offsetIdx }: TokenProps) {
  const prevPos = useRef(player.position);
  const isAnimating = useRef(false);
  const xRef = useRef<number>(cellXY(player.position, boardW, boardH, offsetIdx).x);
  const yRef = useRef<number>(cellXY(player.position, boardW, boardH, offsetIdx).y);
  const elRef = useRef<HTMLDivElement>(null);

  // pulse for canMove
  const [pulsing, setPulsing] = useState(player.canMove);
  useEffect(() => { setPulsing(player.canMove); }, [player.canMove]);

  // step-by-step animation
  useEffect(() => {
    const newPos = player.position;
    const oldPos = prevPos.current;
    if (newPos === oldPos || isAnimating.current || !elRef.current) return;
    isAnimating.current = true;
    prevPos.current = newPos;

    const steps = newPos > oldPos
      ? Array.from({ length: newPos - oldPos }, (_, i) => oldPos + i + 1)
      : [newPos];

    (async () => {
      for (let i = 0; i < steps.length; i++) {
        const { x, y } = cellXY(steps[i], boardW, boardH, offsetIdx);
        const isLast = i === steps.length - 1;
        await animate(
          elRef.current!,
          {
            x: [xRef.current, x],
            y: [yRef.current, y - 16, y],
            scale: isLast ? [1, 1.5, 1] : [1, 1.2, 1],
          },
          {
            duration: STEP_MS / 1000,
            ease: ["easeInOut", "easeIn"],
            times: [0, 0.45, 1],
          }
        );
        xRef.current = x;
        yRef.current = y;
      }
      // landing flash
      await animate(elRef.current!, { opacity: [1, 0.3, 1] }, { duration: 0.2 });
      isAnimating.current = false;
    })();
  }, [player.position, boardW, boardH, offsetIdx]);

  const initPos = cellXY(player.position, boardW, boardH, offsetIdx);

  return (
    <motion.div
      ref={elRef}
      initial={{ x: initPos.x, y: initPos.y, scale: 1 }}
      animate={pulsing ? { scale: [1, 1.35, 1] } : { scale: 1 }}
      transition={pulsing ? { repeat: Infinity, duration: 0.85, ease: "easeInOut" } : { duration: 0.15 }}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: TOKEN_SIZE,
        height: TOKEN_SIZE,
        borderRadius: "50%",
        backgroundColor: player.color,
        border: pulsing ? "2.5px solid #fff" : "1.5px solid rgba(255,255,255,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: pulsing
          ? `0 0 12px 4px ${player.color}, 0 2px 8px rgba(0,0,0,0.5)`
          : `0 0 4px 1px ${player.color}80, 0 1px 4px rgba(0,0,0,0.4)`,
        zIndex: 10,
        cursor: "default",
        userSelect: "none",
      }}
      title={`${player.username} — клетка ${player.position}`}
    >
      <span style={{
        color: "#fff",
        fontSize: 11,
        fontWeight: "bold",
        textShadow: "0 1px 2px rgba(0,0,0,0.7)",
        lineHeight: 1,
      }}>
        {player.username.charAt(0).toUpperCase()}
      </span>
    </motion.div>
  );
}

export default function GameBoard({ players }: { players: GamePlayer[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const playersByCell: Record<number, GamePlayer[]> = {};
  for (const p of players) {
    if (!playersByCell[p.position]) playersByCell[p.position] = [];
    playersByCell[p.position].push(p);
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden" }}
    >
      <img
        src={`${BASE_PATH}board.png`}
        alt="board"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", userSelect: "none", pointerEvents: "none" }}
        draggable={false}
      />
      {dims.w > 0 && players.map(player => {
        const cellPlayers = playersByCell[player.position] ?? [];
        const offsetIdx = cellPlayers.indexOf(player);
        return (
          <PlayerToken
            key={player.id}
            player={player}
            boardW={dims.w}
            boardH={dims.h}
            offsetIdx={offsetIdx}
          />
        );
      })}
    </div>
  );
}
