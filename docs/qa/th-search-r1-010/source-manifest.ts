import fs from 'node:fs';
import crypto from 'node:crypto';
import {RECOVERY_SOURCES} from '../../../lib/ask/recovery-sources';
const json=JSON.stringify(RECOVERY_SOURCES);
fs.writeFileSync('docs/qa/th-search-r1-010/official-sources.json',JSON.stringify({checkedAt:new Date().toISOString(),method:'Official pages independently opened via web tool; browser destination checks recorded separately. No provider lookup or regulatory transaction.',manifestFingerprint:crypto.createHash('sha256').update(json).digest('hex'),sources:RECOVERY_SOURCES,policyEvidence:{source:'texasGc',excerpt:'a state license is not required',scope:'State GC licensing distinction; Austin registration procedures remain municipal.'}},null,2));
