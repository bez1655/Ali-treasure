import React, { useRef, useEffect } from "react";
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Text,
  Dimensions,
} from "react-native";

const BOARD_IMAGE = require("../assets/images/board.png");

// Positions as [x%, y%] from top-left of the board image (0-100)
// Traced from the actual game board image
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

function PlayerToken({ player, boardWidth, boardHeight, offsetIndex }: TokenProps) {
  const pos = CELL_POSITIONS[player.position] ?? CELL_POSITIONS[1];
  const xPct = pos[0] / 100;
  const yPct = pos[1] / 100;

  const TOKEN_SIZE = 22;
  const OFFSET_STEP = 6;

  const animX = useRef(new Animated.Value(xPct * boardWidth)).current;
  const animY = useRef(new Animated.Value(yPct * boardHeight)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animX, {
        toValue: xPct * boardWidth + offsetIndex * OFFSET_STEP,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.spring(animY, {
        toValue: yPct * boardHeight + offsetIndex * OFFSET_STEP,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
    ]).start();
  }, [player.position, boardWidth, boardHeight]);

  useEffect(() => {
    if (player.canMove) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.4, duration: 400, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [player.canMove]);

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
          left: -TOKEN_SIZE / 2,
          top: -TOKEN_SIZE / 2,
          transform: [
            { translateX: animX },
            { translateY: animY },
            { scale: pulse },
          ],
          borderWidth: player.canMove ? 2 : 1,
          borderColor: player.canMove ? "#FFFFFF" : "rgba(0,0,0,0.4)",
          shadowColor: player.canMove ? "#FFF" : "#000",
          shadowOpacity: player.canMove ? 0.9 : 0.3,
          shadowRadius: player.canMove ? 6 : 2,
          elevation: player.canMove ? 8 : 3,
        },
      ]}
    >
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
  const boardHeight = boardWidth; // square board

  const playersByCell: Record<number, GamePlayer[]> = {};
  for (const p of players) {
    const pos = p.position;
    if (!playersByCell[pos]) playersByCell[pos] = [];
    playersByCell[pos].push(p);
  }

  return (
    <View style={[styles.container, { width: boardWidth, height: boardHeight }]}>
      <Image
        source={BOARD_IMAGE}
        style={[styles.boardImage, { width: boardWidth, height: boardHeight }]}
        resizeMode="cover"
      />
      {players.map((player, idx) => {
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
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
  },
});
