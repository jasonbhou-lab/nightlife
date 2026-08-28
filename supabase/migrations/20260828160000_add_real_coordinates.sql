-- Google Maps configuration: the app's map surfaces (search's map toggle,
-- src/components/MiniMap.web.tsx / MiniMap.native.tsx) now render a real
-- Google Map instead of a schematic gradient-and-grid placeholder, which
-- means they need real coordinates rather than the 0..1 normalized `map_x`/
-- `map_y` position the schematic map used for pin placement.
--
-- `venues.lat`/`lng` already existed -- they were populated nowhere, but
-- already read by withDistances() in src/data/repository.ts for a real
-- haversine distance calculation that, until now, always silently fell back
-- to the seed's hand-set distance because the columns were null. Backfilling
-- them for real is a pure improvement to that existing code path, not a new
-- one. `map_x`/`map_y` have no remaining reader anywhere in the app (the
-- schematic map is deleted) and are dropped rather than left as dead columns.

update venues set lat = 29.7595, lng = -95.3660 where id = 'vela';
update venues set lat = 29.7433, lng = -95.3760 where id = 'anhbep';
update venues set lat = 29.7415, lng = -95.3945 where id = 'pier9';
update venues set lat = 29.7965, lng = -95.3985 where id = 'tortilla9';
update venues set lat = 29.8010, lng = -95.4005 where id = 'loyalpour';
update venues set lat = 29.7365, lng = -95.4155 where id = 'kirby3';
update venues set lat = 29.7515, lng = -95.3495 where id = 'ratchet';
update venues set lat = 29.7480, lng = -95.3520 where id = 'cistern';
update venues set lat = 29.7430, lng = -95.3950 where id = 'pocketaces';
update venues set lat = 29.7395, lng = -95.3995 where id = 'bramble';
update venues set lat = 29.7590, lng = -95.3620 where id = 'verso';
update venues set lat = 29.7600, lng = -95.3660 where id = 'quietpart';
update venues set lat = 29.7365, lng = -95.5745 where id = 'zafeera';
update venues set lat = 29.7595, lng = -95.3625 where id = 'halcyon';
update venues set lat = 29.7370, lng = -95.4090 where id = 'ashenoak';
update venues set lat = 29.7175, lng = -95.4110 where id = 'bayouleaf';
update venues set lat = 29.7580, lng = -95.3960 where id = 'emberroom';
update venues set lat = 29.7565, lng = -95.3615 where id = 'kosmos';
update venues set lat = 29.7745, lng = -95.4210 where id = 'salaroja';

alter table venues drop column map_x;
alter table venues drop column map_y;
