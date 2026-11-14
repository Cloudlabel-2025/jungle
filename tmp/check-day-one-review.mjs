import { readFileSync } from 'node:fs';
import { transform, build } from 'esbuild';
import assert from 'node:assert/strict';
import React from 'react';

// Exercise the actual roster component's handlers without touching player data.
const source = readFileSync('components/DayOneFeatures.js', 'utf8');
const component = source.slice(source.indexOf('export function DayOneCohort'));
const { code } = await transform(component.replace('export function', 'function') + '\nreturn DayOneCohort;', { loader: 'jsx', jsx: 'transform' });
let state = [], cursor = 0;
const useState = initial => {
  const index = cursor++;
  if (!(index in state)) state[index] = initial;
  return [state[index], value => { state[index] = value; }];
};
const symbols = ['Panel', 'Badge', 'Search', 'DayOneReview', 'Modal', 'Form', 'LockKeyhole'];
const Cohort = new Function('React', 'useState', 'textField', ...symbols, code)(React, useState, (name, label) => ({ name, label }), ...symbols);
const player = { _id: 'aarav', name: 'Aarav Patel' };
const record = { _id: 'record-1', userId: 'aarav', submissions: [{ id: 'revision-1' }], markers: {}, config: { genres: [] }, verification: { status: 'PENDING' } };
const data = { user: { role: 'CENTRE_COMMAND' }, dayOne: { config: {}, roster: [player, { _id: 'new', name: 'New player' }], records: [record], candidates: [], events: [] } };
const act = () => { throw Error('Opening a review must not mutate player data'); };
const render = () => { cursor = 0; return Cohort({ data, act, now: '2026-11-14' }); };
function all(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(n => all(n, type));
  return [...(node.type === type ? [node] : []), ...all(node.props?.children, type)];
}
let tree = render();
assert.equal(all(tree, 'Modal').length, 0);
let buttons = all(tree, 'button');
assert.equal(buttons[0].props.type, 'button');
assert.equal(buttons[1].props.disabled, true);
buttons[0].props.onClick();
tree = render();
let dialog = all(tree, 'Modal')[0];
assert.match(dialog.props.title, /Aarav Patel/);
assert.equal(dialog.props.portal, true);
assert.equal(all(dialog, 'DayOneReview')[0].props.record, record);
// A refreshed snapshot must update the open review and its version.
const refreshed = { ...record, version: 2 };
data.dayOne.records = [refreshed];
tree = render();
assert.equal(all(tree, 'DayOneReview')[0].props.record, refreshed);
all(tree, 'Modal')[0].props.close();
assert.equal(all(render(), 'Modal').length, 0);
all(render(), 'button')[0].props.onClick();
assert.equal(all(render(), 'Modal').length, 1);
await build({ entryPoints: ['components/DayOneFeatures.js'], bundle: true, platform: 'browser', packages: 'external', loader: { '.js': 'jsx' }, jsx: 'automatic', write: false });
console.log('PASS: Review opens selected player dialog, tracks refreshed records, closes/reopens, disables missing records, and does not mutate data. Component bundle compiles.');

