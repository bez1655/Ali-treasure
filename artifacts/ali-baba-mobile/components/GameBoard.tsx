import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Text,
  Dimensions,
  Easing,
} from "react-native";

const BOARD_IMAGE = require("../assets/images/board.png");

const CELL_POSITIONS: [number, number][] = [
  [0, 0],     // 0 unused
  [50, 90],   // 1  START
  [43, 90],   // 2
  [36, 90],   // 3
  [14, 90],   // 4
  [21, 90],   // 5
  [14, 84],   // 6
  [14, 78],   // 7
  [21, 81],   // 8
  [14, 74],   // 9
  [21, 75],   // 10
  [14, 68],   // 11
  [14, 62],   // 12
  [21, 62],   // 13
  [28, 62],   // 14
  [35, 59],   // 15
  [29, 55],   // 16
  [36, 55],   // 17
  [36, 50],   // 18
  [28, 47],   // 19
  [36, 44],   // 20
  [43, 44],   // 21
  [50, 44],   // 22
  [52, 47],   // 23
  [50, 51],   // 24
  [41, 55],   // 25
  [45, 60],   // 26
  [51, 63],   // 27
  [44, 63],   // 28
  [57, 50],   // 29
  [59, 56],   // 30
  [61, 63],   // 31
  [62, 63],   // 32
  [63, 63],   // 33
  [66, 60],   // 34
  [68, 63],   // 35
  [69, 63],   // 36
  [72, 60],   // 37
  [75, 63],   // 38
  [77, 63],   // 39
  [79, 70],   // 40
  [77, 75],   // 41
  [76, 78],   // 42
  [68, 38],   // 43
  [61, 35],   // 44
  [54, 32],   // 45
  [47, 30],   // 46
  [14, 33],   // 47
  [20, 29],   // 48
  [27, 27],   // 49
  [33, 25],   // 50
  [39, 27],   // 51
  [45, 29],   // 52
  [51, 31],   // 53
  [53, 32],   // 54
  [59, 28],   // 55
  [63, 24],   // 56
  [70, 19],   // 57
  [76, 16],   // 58
  [81, 13],   // 59
  [86, 11],   // 60 FINISH
];

export interface GamePlayer {
  id: number;
  userId: number;
  username: string;
  position: number;
  color: string;
  canMove: boolean;
}

interface TokenProps {
  player: GamePlayer;
  boardWidth: number;
  boardHeight: number;
  offsetIndex: number;
}

const STEP_DURATION = 160;   // ms per cell step
const BOUNCE_HEIGHT = 18;    // px — how high the token hops

function getXY(cell: number, bw: number, bh: number, offsetIndex: number, tokenSize: number) {
  const pos = CELL_POSITIONS[Math.max(1, Math.min(60, cell))] ?? CELL_POSITIONS[1];
  return {
    x: (pos[0] / 100) * bw + offsetIndex * 6 - tokenSize / 2,
    y: (pos[1] / 100) * bh + offsetIndex * 6 - tokenSize / 2,
  };
}

function PlayerToken({ player, boardWidth, boardHeight, offsetIndex }: TokenProps) {
  const TOKEN_SIZE = 24;
  const prevPositionRef = useRef(player.position);
  const isAnimatingRef = useRef(false);

  const { x: initX, y: initY } = getXY(player.position, boardWidth, boardHeight, offsetIndex, TOKEN_SIZE);

  const animX = useRef(new Animated.Value(initX)).current;
  const animY = useRef(new Animated.Value(initY)).current;
  const animZ = useRef(new Animated.Value(0)).current;   // vertical hop (translateY offset)
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  // Step-by-step movement animation
  useEffect(() => {
    const newPos = player.position;
    const oldPos = prevPositionRef.current;

    if (newPos === oldPos || isAnimatingRef.current) return;
    if (boardWidth === 0) return;

    isAnimatingRef.current = true;
    prevPositionRef.current = newPos;

    const steps = newPos > oldPos
      ? Array.from({ length: newPos - oldPos }, (_, i) => oldPos + i + 1)
      : [newPos];

    const animations: Animated.CompositeAnimation[] = [];

    for (let i = 0; i < steps.length; i++) {
      const cell = steps[i];
      const { x, y } = getXY(cell, boardWidth, boardHeight, offsetIndex, TOKEN_SIZE);
      const isLast = i === steps.length - 1;

      // Hop up then land on each cell
      animations.push(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(animZ, {
              toValue: -BOUNCE_HEIGHT,
              duration: STEP_DURATION * 0.45,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(animZ, {
              toValue: 0,
              duration: STEP_DURATION * 0.55,
              easing: Easing.in(Easing.bounce),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animX, {
            toValue: x,
            duration: STEP_DURATION,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animY, {
            toValue: y,
            duration: STEP_DURATION,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Scale up slightly during hop
          ...(isLast
            ? [Animated.sequence([
                Animated.timing(pulse, { toValue: 1.5, duration: STEP_DURATION * 0.4, useNativeDriver: true }),
                Animated.spring(pulse, { toValue: 1, useNativeDriver: true, tension: 200, friction: 5 }),
              ])]
            : [Animated.sequence([
                Animated.timing(pulse, { toValue: 1.2, duration: STEP_DURATION * 0.5, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1.0, duration: STEP_DURATION * 0.5, useNativeDriver: true }),
              ])]),
        ])
      );
    }

    // Flash glow on arrival
    const glowAnim = Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 400, useNativeDriver: false }),
    ]);

    Animated.sequence(animations).start(() => {
      glowAnim.start();
      isAnimatingRef.current = false;
    });
  }, [player.position, boardWidth, boardHeight]);

  // Pulse when it's this player's turn
  useEffect(() => {
    if (player.canMove) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.35, duration: 420, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 420, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [player.canMove]);

  const glowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0)", "rgba(255,255,255,0.95)"],
  });

  return (
    <Animated.View
      style={[
        styles.token,
        {
          width: TOKEN_SIZE,
          height: TOKEN_SIZE,
          borderRadius: TOKEN_SIZE / 2,
          backgroundColor: player.color,
          position: "absolute",
          left: 0,
          top: 0,
          transform: [
            { translateX: animX },
            { translateY: animY },
            { translateY: animZ },
            { scale: pulse },
          ],
          borderWidth: player.canMove ? 2.5 : 1.5,
          borderColor: player.canMove ? "#FFFFFF" : "rgba(255,255,255,0.25)",
          shadowColor: player.color,
          shadowOpacity: 0.8,
          shadowRadius: player.canMove ? 8 : 3,
          shadowOffset: { width: 0, height: 2 },
          elevation: player.canMove ? 10 : 4,
        },
      ]}
    >
      {/* Glow flash on landing */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: TOKEN_SIZE / 2, backgroundColor: glowColor },
        ]}
      />
      <Text style={styles.tokenText}>{player.username.charAt(0).toUpperCase()}</Text>
    </Animated.View>
  );
}

interface GameBoardProps {
  players: GamePlayer[];
}

export default function GameBoard({ players }: GameBoardProps) {
  const screenWidth = Dimensions.get("window").width;
  const boardWidth = screenWidth - 16;
  const boardHeight = boardWidth;

  const playersByCell: Record<number, GamePlayer[]> = {};
  for (const p of players) {
    if (!playersByCell[p.position]) playersByCell[p.position] = [];
    playersByCell[p.position].push(p);
  }

  return (
    <View style={[styles.container, { width: boardWidth, height: boardHeight }]}>
      <Image
        source={BOARD_IMAGE}
        style={[styles.boardImage, { width: boardWidth, height: boardHeight }]}
        resizeMode="cover"
      />
      {players.map((player) => {
        const cellPlayers = playersByCell[player.position] ?? [];
        const offsetIndex = cellPlayers.indexOf(player);
        return (
          <PlayerToken
            key={player.id}
            player={player}
            boardWidth={boardWidth}
            boardHeight={boardHeight}
            offsetIndex={offsetIndex}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    alignSelf: "center",
  },
  boardImage: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  token: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  tokenText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
