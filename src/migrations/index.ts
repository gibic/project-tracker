import * as migration_20261022_143807_initial from './20261022_143807_initial';
import * as migration_20261105_105231_add_user_api_keys from './20261105_105231_add_user_api_keys';
import * as migration_20261105_110738_add_oauth from './20261105_110738_add_oauth';
import * as migration_20261115_111646_add_task_recurrence from './20261115_111646_add_task_recurrence';
import * as migration_20261115_112652_add_search from './20261115_112652_add_search';
import * as migration_20261115_130500_add_task_checklist from './20261115_130500_add_task_checklist';
import * as migration_20261116_150138_add_task_board_indexes from './20261116_150138_add_task_board_indexes';

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
    name: '20261105_110738_add_oauth',
  },
  {
    up: migration_20261115_111646_add_task_recurrence.up,
    down: migration_20261115_111646_add_task_recurrence.down,
    name: '20261115_111646_add_task_recurrence',
  },
  {
    up: migration_20261115_112652_add_search.up,
    down: migration_20261115_112652_add_search.down,
    name: '20261115_112652_add_search',
  },
  {
    up: migration_20261115_130500_add_task_checklist.up,
    down: migration_20261115_130500_add_task_checklist.down,
    name: '20261115_130500_add_task_checklist',
  },
  {
    up: migration_20261116_150138_add_task_board_indexes.up,
    down: migration_20261116_150138_add_task_board_indexes.down,
    name: '20261116_150138_add_task_board_indexes'
  },
];
