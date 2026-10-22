import * as migration_20261022_143807_initial from './20261022_143807_initial';

export const migrations = [
  {
    up: migration_20261022_143807_initial.up,
    down: migration_20261022_143807_initial.down,
    name: '20261022_143807_initial'
  },
];
