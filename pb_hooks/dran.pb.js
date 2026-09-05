/// <reference path="../pb_data/types.d.ts" />

const DAY_MS = 24 * 60 * 60 * 1000;

onRecordCreate((event) => {
  if (!event.record.getString('list')) event.record.set('list', 'offen');
  if (event.record.getString('list') === 'fertig' && !event.record.getString('doneAt')) {
    event.record.set('doneAt', new Date().toISOString());
  }
  event.next();
}, 'cards');

onRecordCreate((event) => {
  if (!event.record.getBool('active')) event.record.set('active', true);
  event.next();
}, 'members');

onRecordUpdate((event) => {
  const before = event.record.original().getString('list');
  const after = event.record.getString('list');
  if (before !== after) {
    event.record.set('doneAt', after === 'fertig' ? new Date().toISOString() : '');
  }
  event.next();
}, 'cards');

onRecordUpdate((event) => {
  if (event.record.original().getString('color') !== event.record.getString('color')) {
    throw new BadRequestError('Die Farbe eines Mitglieds kann nachträglich nicht geändert werden.');
  }
  event.next();
}, 'members');

function archiveOldCards() {
  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const records = $app.findRecordsByFilter(
    'cards',
    'archived = false && doneAt != "" && doneAt < {:cutoff}',
    'doneAt',
    500,
    0,
    { cutoff }
  );
  for (const record of records) {
    record.set('archived', true);
    $app.save(record);
  }
  if (records.length) console.log(`Dran: ${records.length} alte Karten archiviert.`);
}

cronAdd('dran_archive_cards', '30 2 * * *', archiveOldCards);
