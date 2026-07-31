import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterFeatures } from './filters.js';

const sites = [
  { properties: { name: 'Noblett Lake', land_manager: 'Mark Twain National Forest', access: 'paved', amenities: ['vault_toilet', 'fire_ring'] } },
  { properties: { name: 'North Fork', land_manager: 'Mark Twain National Forest', access: 'gravel', amenities: ['fire_ring', 'water_nearby'] } },
  { properties: { name: 'Riverside CA', land_manager: 'Missouri Department of Conservation', access: 'gravel', amenities: ['picnic_table'] } },
  { properties: { name: 'Sparse Site', land_manager: 'Other', access: '4wd_recommended' } },
];

test('no criteria returns everything', () => {
  const out = filterFeatures(sites, { query: '', land_manager: new Set(), access: new Set(), amenities: new Set() });
  assert.equal(out.length, 4);
});

test('name search is case-insensitive substring', () => {
  const out = filterFeatures(sites, { query: 'noblett', land_manager: new Set(), access: new Set(), amenities: new Set() });
  assert.deepEqual(out.map((f) => f.properties.name), ['Noblett Lake']);
});

test('OR within a category', () => {
  const out = filterFeatures(sites, {
    query: '',
    land_manager: new Set(['Mark Twain National Forest', 'Missouri Department of Conservation']),
    access: new Set(),
    amenities: new Set(),
  });
  assert.equal(out.length, 3);
});

test('AND across categories', () => {
  const out = filterFeatures(sites, {
    query: '',
    land_manager: new Set(['Mark Twain National Forest']),
    access: new Set(['gravel']),
    amenities: new Set(),
  });
  assert.deepEqual(out.map((f) => f.properties.name), ['North Fork']);
});

test('amenities match if site has ANY checked amenity', () => {
  const out = filterFeatures(sites, {
    query: '',
    land_manager: new Set(),
    access: new Set(),
    amenities: new Set(['vault_toilet', 'picnic_table']),
  });
  assert.deepEqual(out.map((f) => f.properties.name), ['Noblett Lake', 'Riverside CA']);
});

test('missing optional amenities field does not crash', () => {
  const out = filterFeatures(sites, {
    query: '',
    land_manager: new Set(),
    access: new Set(),
    amenities: new Set(['fire_ring']),
  });
  assert.deepEqual(out.map((f) => f.properties.name), ['Noblett Lake', 'North Fork']);
});

test('search combines with checkbox filters', () => {
  const out = filterFeatures(sites, {
    query: 'river',
    land_manager: new Set(['Missouri Department of Conservation']),
    access: new Set(),
    amenities: new Set(),
  });
  assert.deepEqual(out.map((f) => f.properties.name), ['Riverside CA']);
});
