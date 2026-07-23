export function archiveCountText(count: number, shared: boolean): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const one = shared ? 'здійснена мрія' : 'подарований спогад';
  const few = shared ? 'здійснені мрії' : 'подаровані спогади';
  const many = shared ? 'здійснених мрій' : 'подарованих спогадів';

  if (last === 1 && lastTwo !== 11) return `${count} ${one}`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
}
