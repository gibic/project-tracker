import * as migration_20261022_143807_initial from './20261022_143807_initial';
import * as migration_20261105_105231_add_user_api_keys from './20261105_105231_add_user_api_keys';
import * as migration_20261105_110738_add_oauth from './20261105_110738_add_oauth';

export const migrations = [
  {
    up: migration_20261022_143807_initial.up,
    down: migration_20261022_143807_initial.down,
    name: '20261022_143807_initial',
  },
  {
    up: migration_20261105_105231_add_user_api_keys.up,
    down: migration_20261105_105231_add_user_api_keys.down,
    name: '20261105_105231_add_user_api_keys',
  },
  {
    up: migration_20261105_110738_add_oauth.up,
    down: migration_20261105_110738_add_oauth.down,
    name: '20261105_110738_add_oauth'
  },
];
