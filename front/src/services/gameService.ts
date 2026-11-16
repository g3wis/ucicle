import dayjs from 'dayjs';
import { GameParticipation } from '../types/GameType';
import { Rider } from '../types/CyclingTypes';

const gameHistoryKey = 'game-history';

const getTodayDate = (): string => dayjs().format('YYYYMMDD');

export function addGameSession(secret: Rider, guesses: Rider[], success: boolean) {
  const date: string = getTodayDate();
  const gameHistory: GameParticipation[] = JSON.parse(localStorage.getItem(gameHistoryKey) ?? '[]');
  const newGameHistory: GameParticipation[] = [
    ...gameHistory.filter((gameSession: GameParticipation) => gameSession.date !== date),
    {
      rider: secret, guesses, date, success,
    },
  ];
  localStorage.setItem(gameHistoryKey, JSON.stringify(newGameHistory));
}

export function getGameHistory() {
  const gameHistory: GameParticipation[] = JSON.parse(localStorage.getItem(gameHistoryKey) ?? '[]');
  return gameHistory;
}

export function getTodayGameSession(gameHistory: GameParticipation[]) {
  const date: string = getTodayDate();
  return gameHistory.filter((gameSession: GameParticipation) => gameSession.date === date)?.[0] ?? null;
}

const copyToClipboard = (str: string) => {
  const el = document.createElement('textarea');
  el.value = str;
  el.setAttribute('readonly', '');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

export function share(gameSession: GameParticipation) {
  const title: string = `#Ucicle 🚴 - #${gameSession.date}`;
  const cubes: string = gameSession.guesses.reduce(
    (acc: string, value: Rider, index: number): string => ((index === gameSession.guesses.length - 1)
      ? `${acc}${gameSession.success ? '🟩' : '🟥'}`
      : `${acc}🟥`),
    '');
  const symbol = gameSession.success ? '🎉' : '🔴';
  const trys: string = `(${gameSession.guesses.length}/5)`;
  const result: string = `${symbol} ${trys} ${cubes}`;

  const url = document.location.origin;

  const content: string = `${title}\n${result}\n${url}`;

  if (navigator.clipboard?.writeText) navigator.clipboard?.writeText(content);
  else copyToClipboard(content);
}
