export const BOARD_SIZE = 8;

export function swap(board, first, second) {
  [board[first], board[second]] = [board[second], board[first]];
}

export function areAdjacent(first, second, size = BOARD_SIZE) {
  const firstRow = Math.floor(first / size);
  const secondRow = Math.floor(second / size);
  const firstColumn = first % size;
  const secondColumn = second % size;
  return Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1;
}

export function findMatches(board, size = BOARD_SIZE) {
  const matches = new Set();
  for (let row = 0; row < size; row++) {
    let runStart = 0;
    for (let column = 1; column <= size; column++) {
      const current = column < size ? board[row * size + column] : null;
      const start = board[row * size + runStart];
      if (current === start && start !== null) continue;
      if (start !== null && column - runStart >= 3)
        for (let x = runStart; x < column; x++) matches.add(row * size + x);
      runStart = column;
    }
  }
  for (let column = 0; column < size; column++) {
    let runStart = 0;
    for (let row = 1; row <= size; row++) {
      const current = row < size ? board[row * size + column] : null;
      const start = board[runStart * size + column];
      if (current === start && start !== null) continue;
      if (start !== null && row - runStart >= 3)
        for (let y = runStart; y < row; y++) matches.add(y * size + column);
      runStart = row;
    }
  }
  return matches;
}

export function findPossibleMove(board, size = BOARD_SIZE) {
  for (let index = 0; index < board.length; index++) {
    const column = index % size;
    for (const other of [column < size - 1 ? index + 1 : -1, index + size]) {
      if (other < 0 || other >= board.length) continue;
      swap(board, index, other);
      const works = findMatches(board, size).size > 0;
      swap(board, index, other);
      if (works) return [index, other];
    }
  }
  return null;
}

export function createBoard(typeCount, random = Math.random, size = BOARD_SIZE) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const board = [];
    for (let index = 0; index < size * size; index++) {
      const row = Math.floor(index / size);
      const column = index % size;
      const choices = Array.from({ length: typeCount }, (_, type) => type).filter(
        (type) =>
          !(column >= 2 && board[index - 1] === type && board[index - 2] === type) &&
          !(row >= 2 && board[index - size] === type && board[index - size * 2] === type),
      );
      board.push(choices[Math.floor(random() * choices.length)]);
    }
    if (findPossibleMove(board, size)) return board;
  }
  throw new Error("Unable to create a playable board.");
}
