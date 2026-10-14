import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/page-meta';

const sources = [
  { title: 'Alaska CBPL public records and database downloads', url: 'https://www.commerce.alaska.gov/cbp/main/' },
  { title: 'Construction Contractors licensing', url: 'https://www.commerce.alaska.gov/web/CBPL/ProfessionalLicensing/ConstructionContractors.aspx' },
  { title: 'Construction Contractors FAQs', url: 'https://www.commerce.alaska.gov/web/cbpl/professionallicensing/constructioncontractors/constructioncontractorsfaqs.aspx' },
  { title: 'Alaska Department of Labor electrical and plumbing certificates of fitness', url: 'https://labor.alaska.gov/lss/plumbing_electrical.htm' },
  { title: 'Mechanical Inspection certificate of fitness requirements', url: 'https://labor.alaska.gov/lss/mi-license-req.html' },
];

export const metadata: Metadata = pageMetadata({
  title: 'Alaska contractor and trade licensing evidence',
  description: 'Alaska statewide contractor business licenses and separate professional trade-person credentials, with source limitations.',
  path: '/alaska',
});

export default function AlaskaContractorPage() {
  return <main className="state-page">
    <h1>Alaska contractor and trade licensing</h1>
    <p>Alaska licenses construction contractor businesses by program class. This is not a universal general-contractor-only census. The state identifies general, residential, specialty, mechanical, and handyman contractor categories; the handyman category has a stated per-project contract limit. Contractor businesses and individually licensed tradespeople remain separate.</p>
    <section aria-labelledby="contractor-businesses"><h2 id="contractor-businesses">Contractor businesses</h2>
      <p>Current row-level contractor business records and counts are <strong>NOT_ACQUIRED — PUBLIC FREE DATABASE ENDPOINT RETURNED HTTP 403</strong> from this retrieval environment. Alaska CBPL describes public CSV database downloads; no verification gate was bypassed and no count is inferred from another source.</p>
      <p>General, residential, specialty (limited trade scope), mechanical, and handyman licenses are distinct state business license classes. Their counts should not be combined into an undifferentiated contractor total.</p>
    </section>
    <section aria-labelledby="trade-persons"><h2 id="trade-persons">Separately licensed trade persons</h2>
      <ul><li>Electrical certificates of fitness include distinct journeyman, residential wireman, power lineman, and trainee/provisional classes.</li><li>Plumbing certificates of fitness include journeyman, gas, utility, and trainee/provisional classes.</li><li>Mechanical Inspection certificate classes and contractor-company administrators are separate from individual certificates and general contractor business licenses.</li></ul>
      <p>Current person-level rows and class counts were not acquired; the CBPL professional-license bulk endpoint returned HTTP 403. This is an access limitation, not evidence that the population is empty.</p>
    </section>
    <section aria-labelledby="source-clock"><h2 id="source-clock">Source clocks and limits</h2><p>Official Alaska CBPL and Department of Labor sources checked October 14, 2026. The state advertises public downloads, but a current dated extract was not available through this retrieval. Business licenses, contractor-class licenses, professional certificates, qualifying administrators, applications, and discipline remain distinct records. No municipal licensing is included.</p>
      <ul>{sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
    </section>
  </main>;
}
