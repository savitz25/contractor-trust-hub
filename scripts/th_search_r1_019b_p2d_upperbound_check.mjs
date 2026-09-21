import { PGlite } from "@electric-sql/pglite";
const pg = new PGlite();
await pg.exec(`CREATE TABLE t (name text)`);
const withEmoji = "TESTCO \u{1F3D7} BUILDERS";
await pg.query(`INSERT INTO t VALUES ($1)`, [withEmoji]);

// Use the ACTUAL operators text_pattern_ops indexes are built on (~>=~ / ~<~), which force raw
// byte/C-locale comparison -- exactly what the real access path would use, unlike plain >=/< which
// follow the database's default (possibly ICU) collation and are not representative.
const naiveUpper = "TESTCO" + "￿";
const r1 = await pg.query(`SELECT name FROM t WHERE name ~>=~ $1 AND name ~<~ $2`, ["TESTCO", naiveUpper]);
console.log("Naive U+FFFF upper bound (~>=~/~<~, C-locale byte compare) -- rows matched:", r1.rows.length, "(expect 0 = false negative if unsafe)");

const r2 = await pg.query(`SELECT name FROM t WHERE name LIKE $1`, ["TESTCO%"]);
console.log("LIKE 'TESTCO%%' -- rows matched:", r2.rows.length, "(ground truth, expect 1)");

const trueMaxUpper = "TESTCO" + "\u{10FFFF}";
await pg.query(`INSERT INTO t VALUES ($1)`, ["TESTCO" + "\u{10FFFF}" + "X"]);
const r3 = await pg.query(`SELECT name FROM t WHERE name ~>=~ $1 AND name ~<~ $2`, ["TESTCO", trueMaxUpper]);
console.log("True-max U+10FFFF upper bound (~>=~/~<~) -- rows matched:", r3.rows.length, "(expect 2 if safe, since both real rows start with TESTCO)");
const r4 = await pg.query(`SELECT name FROM t WHERE name LIKE $1`, ["TESTCO%"]);
console.log("LIKE 'TESTCO%%' after second insert -- rows matched:", r4.rows.length, "(ground truth, expect 2)");
await pg.close();
