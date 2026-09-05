/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const authenticated = '@request.auth.id != ""';

  const users = app.findCollectionByNameOrId('users');
  users.listRule = null;
  users.viewRule = null;
  users.createRule = null;
  users.updateRule = null;
  users.deleteRule = null;
  users.manageRule = null;
  users.authRule = '';
  users.passwordAuth.enabled = true;
  users.passwordAuth.identityFields = ['email'];
  users.authToken.duration = 60 * 60 * 24 * 365;
  app.save(users);

  const members = new Collection({
    id: 'dranmembers0001',
    type: 'base',
    name: 'members',
    listRule: authenticated,
    viewRule: authenticated,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: 'text', name: 'name', required: true, max: 24 },
      {
        type: 'select',
        name: 'color',
        required: true,
        maxSelect: 1,
        values: ['teal', 'brown', 'green', 'purple', 'rose', 'ochre', 'blue', 'red']
      },
      { type: 'text', name: 'emoji', max: 4 },
      { type: 'relation', name: 'user', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { type: 'bool', name: 'active' },
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
    ]
  });
  app.save(members);
  members.indexes = ['CREATE INDEX `idx_members_active_name` ON `members` (`active`, `name`)'];
  app.save(members);

  const cards = new Collection({
    id: 'drancards000001',
    type: 'base',
    name: 'cards',
    listRule: authenticated,
    viewRule: authenticated,
    createRule: authenticated,
    updateRule: authenticated,
    deleteRule: authenticated,
    fields: [
      { type: 'text', name: 'title', required: true, max: 120 },
      { type: 'text', name: 'notes', max: 2000 },
      { type: 'select', name: 'list', required: true, maxSelect: 1, values: ['offen', 'dran', 'fertig'] },
      { type: 'text', name: 'pos', required: true, max: 255 },
      { type: 'relation', name: 'assignees', collectionId: members.id, maxSelect: 8, cascadeDelete: false },
      { type: 'date', name: 'due' },
      { type: 'date', name: 'doneAt' },
      { type: 'bool', name: 'archived' },
      { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
    ]
  });
  app.save(cards);
  cards.indexes = [
    'CREATE INDEX `idx_cards_board` ON `cards` (`archived`, `list`, `pos`)',
    'CREATE INDEX `idx_cards_done` ON `cards` (`archived`, `doneAt`)'
  ];
  app.save(cards);

  const settings = app.settings();
  settings.meta.appName = 'Dran';
  settings.backups.cron = '0 3 * * *';
  settings.backups.cronMaxKeep = 14;
  app.save(settings);
}, (app) => {
  for (const name of ['cards', 'members']) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {
      // Allows partial rollback while developing the initial migration.
    }
  }
});
