import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
const pg = new PGlite({ extensions: { pg_trgm } });
await pg.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
const gin = await pg.query(`
  SELECT amop.amopopr::regoperator AS operator
  FROM pg_opfamily opf
  JOIN pg_amop amop ON amop.amopfamily = opf.oid
  WHERE opf.opfname = 'gin_trgm_ops'
  ORDER BY 1;
`);
console.log("gin_trgm_ops operator family operators:");
for (const r of gin.rows) console.log(" ", r.operator);

const btree = await pg.query(`
  SELECT amop.amopopr::regoperator AS operator
  FROM pg_opfamily opf
  JOIN pg_amop amop ON amop.amopfamily = opf.oid
  WHERE opf.opfname = 'text_pattern_ops'
  ORDER BY 1;
`);
console.log("\ntext_pattern_ops operator family operators:");
for (const r of btree.rows) console.log(" ", r.operator);
await pg.close();
