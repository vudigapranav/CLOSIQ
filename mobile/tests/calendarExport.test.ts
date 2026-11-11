import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeIcsText, foldIcsLine, hasRealTime, icsFileName } from '../../src/services/calendarExport';

const NOW = new Date(Date.UTC(2026, 10, 11, 8, 30, 5));

test('timed event has floating DTSTART/DTEND, stable UID and CRLF endings', () => {
  const ics = buildIcs([{ id: 'event-123', title: 'Dinner', date: '2026-11-20', time: '19:30' }], NOW);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('UID:event-123@closiq.app'));
  assert.ok(ics.includes('DTSTAMP:20261111T083005Z'));
  assert.ok(ics.includes('DTSTART:20261120T193000'));
  assert.ok(ics.includes('DTEND:20261120T203000'));
  assert.equal(buildIcs([{ id: 'event-123', title: 'Dinner', date: '2026-11-20', time: '19:30' }], new Date()).includes('UID:event-123@closiq.app'), true);
});

test('event crossing midnight rolls DTEND to the next day', () => {
  const ics = buildIcs([{ id: 'e', title: 'Late', date: '2026-12-31', time: '23:30' }], NOW);
  assert.ok(ics.includes('DTEND:20270101T003000'));
});

test('no time produces an all-day VALUE=DATE event', () => {
  const ics = buildIcs([{ id: 'e', title: 'Wedding', date: '2026-02-28', time: null }], NOW);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260228'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260301'));
  assert.equal(hasRealTime('00:00'), false);
  assert.equal(hasRealTime('09:15'), true);
});

test('text is escaped and outfit piece names are in the description', () => {
  assert.equal(escapeIcsText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const ics = buildIcs(
    [{ id: 'e', title: 'Date, night; fun', date: '2026-11-20', time: '19:00', occasion: 'Date', notes: 'line1\nline2',
       outfit: { title: 'Evening', items: [{ name: 'Navy Shirt' }, { name: 'Grey Chinos' }] } }],
    NOW
  );
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Date\\, night\\; fun'));
  assert.ok(unfolded.includes('Navy Shirt\\, Grey Chinos'));
  assert.ok(unfolded.includes('Notes: line1\\nline2'));
});

test('long lines fold at 75 octets without splitting characters', () => {
  const line = 'DESCRIPTION:' + 'é'.repeat(100);
  const folded = foldIcsLine(line);
  for (const part of folded.split('\r\n')) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), line);
});

test('many events and invalid dates', () => {
  const ics = buildIcs([
    { id: 'a', title: 'A', date: '2026-11-20' },
    { id: 'b', title: 'B', date: 'nope' },
    { id: 'c', title: 'C', date: '2026-11-21', time: '08:00' }
  ], NOW);
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
  assert.equal(icsFileName('Sam & Co. Wedding!'), 'sam-co-wedding.ics');
});
