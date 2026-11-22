# How far the drawn borders are from their sources (Phase 6 step 2)

Measured by `npm run measure-alignment` for 1 June 1934: 22 OpenHistoricalMap records and 86 Cliopatria records in effect that day. Each table gives the median, 95th and 99th percentiles, the largest value, and how many points were measured.

## 1. The tiles against the imported OpenHistoricalMap shapes

The import already simplified each border to within 0.005° (about 500 m) of OpenHistoricalMap's own line (its manifest); these numbers are on top of that. "Drawn line off its source": how far each point the map draws is from the imported border. "Source detail left out": how far each point of the imported border is from the drawn line, which is what shows as small shapes not lining up; it leaves out the stretches the map never draws as lines (more than 2 km out to sea, and along the import's edge). From zoom 8, the map enlarges the zoom-7 tiles, so their error stays as at zoom 7 in km while growing on screen.

| Zoom | Drawn line off its source: median | 95% | 99% | largest | points | Source detail left out: median | 95% | 99% | largest | points |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 224 m | 532 m | 651 m | 797 m | 4,928 | 582 m | 2.4 km | 3.3 km | 62.7 km | 23,199 |
| 4 | 107 m | 263 m | 323 m | 450 m | 9,269 | 263 m | 1.3 km | 1.7 km | 5.6 km | 23,723 |
| 5 | 55 m | 145 m | 182 m | 248 m | 16,515 | 78 m | 730 m | 947 m | 5.6 km | 23,262 |
| 6 | 31 m | 89 m | 111 m | 147 m | 23,039 | 32 m | 103 m | 341 m | 5.5 km | 23,229 |
| 7 | 13 m | 32 m | 40 m | 48 m | 24,258 | 13 m | 32 m | 40 m | 5.5 km | 23,345 |

## 2. Coastal stretches against Natural Earth's 1:10m coastline

For every point of a shape's border within 25 km of Natural Earth's coastline: how far it is from that coastline, split by side. **On land, short of the coast**: the shape stops before the sea, leaving a strip the map shows as "no data" (the coast gaps of question 3). **At sea, beyond the coast**: the shape runs out over the water (often on purpose, to include territorial waters); the map draws Natural Earth's sea over it from zoom 4, so it doesn't show.

| Shapes | Side | median | 95% | 99% | largest | points |
|---|---|---|---|---|---|---|
| OpenHistoricalMap, East Asia | on land, short of the coast (5% of points) | 11.8 km | 23.4 km | 24.4 km | 25.0 km | 783 |
| OpenHistoricalMap, East Asia | at sea, beyond the coast (95%) | 6.2 km | 16.6 km | 22.4 km | 25.0 km | 15,318 |
| Cliopatria, worldwide | on land, short of the coast (28% of points) | 2.7 km | 14.5 km | 22.2 km | 25.0 km | 4,919 |
| Cliopatria, worldwide | at sea, beyond the coast (72%) | 5.1 km | 16.2 km | 20.8 km | 24.9 km | 12,668 |
