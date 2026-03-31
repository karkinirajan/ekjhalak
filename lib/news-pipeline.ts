import { sourceRegistry } from "./news-sources"
import { buildPublishedAt } from "./utils"

export type RangeKey = "day" | "week" | "month"
export type BucketKey = "national" | "international"

export interface NewsItem {
  id: string
  bucket: BucketKey
  title: string
  source: string
  sourceUrl: string
  publishedAt: string
  summaryEn: string
  summaryNp: string
}

const nationalSeeds: Record<RangeKey, { title: string; summaryEn: string; summaryNp: string }[]> = {
  day: [
    {
      title: "Cabinet advances digital public service reform roadmap",
      summaryEn:
        "Officials moved another step toward digitised public services, focusing on citizen portals, document workflows, and interoperability. The real test remains execution quality, where public reform often stumbles between policy and delivery.",
      summaryNp:
        "सरकारले डिजिटल सार्वजनिक सेवातर्फ अर्को कदम चालेको छ। ध्यान नागरिक पोर्टल, कागजात प्रवाह र प्रणालीबीचको एकीकरणमा छ। तर अन्तिम परीक्षा कार्यान्वयनकै हो, किनकि नीति र सेवाबीचको गल्लीमै धेरै सुधार हराउँछन्।",
    },
    {
      title: "Power exports and dry season supply remain in tension",
      summaryEn:
        "Energy coverage highlights Nepal's old paradox: export confidence during strong generation and domestic anxiety during drier months. The durable solution depends on storage, transmission, and seasonal planning.",
      summaryNp:
        "ऊर्जा क्षेत्रमा नेपालले पुरानै विरोधाभास झेलिरहेको छ। उत्पादन बढी हुँदा निर्यातमा आत्मविश्वास बढ्छ, तर सुख्खा मौसममा आन्तरिक आपूर्तिको चिन्ता उस्तै रहन्छ। दिगो समाधान भण्डारण, प्रसारण र मौसमी योजनामा निर्भर छ।",
    },
    {
      title: "Urban air quality spike pushes health warning conversations",
      summaryEn:
        "Pollution has returned to the center of public discussion. Advisories help in the short term, but lasting relief depends on transport discipline, dust control, and real enforcement.",
      summaryNp:
        "प्रदूषण फेरि सार्वजनिक बहसको केन्द्रमा आएको छ। छोटो अवधिमा चेतावनी उपयोगी भए पनि दिगो सुधार यातायात अनुशासन, धुलो नियन्त्रण र कार्यान्वयनमै निर्भर हुन्छ।",
    },
    {
      title: "Local governments push for faster budget execution",
      summaryEn:
        "Coverage around local budgets suggests that release timing, procurement delays, and weak project pacing remain the quiet villains of development work. The story is administrative rhythm more than announcement volume.",
      summaryNp:
        "स्थानीय बजेट सम्बन्धी समाचारले रकम निकासा समय, खरिद ढिलाइ र कमजोर परियोजना गति नै विकास कार्यका शान्त खलनायक भएको देखाउँछ। कथा घोषणाको होइन, प्रशासनिक लयको हो।",
    },
    {
      title: "Tourism operators seek steadier policy signals before peak season",
      summaryEn:
        "Tourism stakeholders want clearer coordination on access, safety, and service quality before the next high season. Revenue depends not only on arrivals, but on how well the whole visitor chain behaves under pressure.",
      summaryNp:
        "पर्यटन क्षेत्रले भीड बढ्नु अघि पहुँच, सुरक्षा र सेवा गुणस्तरमा स्पष्ट नीतिगत संकेत खोजिरहेको छ। आम्दानी केवल पर्यटक संख्या होइन, समग्र सेवा शृंखला कत्तिको मजबुत छ भन्नेमा निर्भर हुन्छ।",
    },
    {
      title: "Remittance-linked household spending continues to shape demand",
      summaryEn:
        "Household demand still reflects the gravity of foreign employment. The headline is not just remittance volume, but how that money stabilizes consumption, education decisions, and urban migration choices.",
      summaryNp:
        "घरपरिवारको खर्च ढाँचा अझै वैदेशिक रोजगारीको प्रभावमा छ। मुख्य कुरा केवल रेमिट्यान्सको मात्रा होइन, त्यसले उपभोग, शिक्षामा निर्णय र सहरतर्फको बसाइँसराइलाई कसरी स्थिर बनाउँछ भन्ने हो।",
    },
  ],
  week: [
    {
      title: "Election aftershocks continue to reshape party negotiations",
      summaryEn:
        "Political energy has shifted from campaign theatre to coalition arithmetic. The deeper question is which players can transform noisy mandates into stable parliamentary behavior.",
      summaryNp:
        "राजनीति चुनावी नाटकबाट गठबन्धन गणिततर्फ सरेको छ। मूल प्रश्न ठूलो आवाज होइन, बरु कसले जनादेशलाई स्थिर संसदीय व्यवहारमा रूपान्तरण गर्न सक्छ भन्ने हो।",
    },
    {
      title: "Tourism policy and mountain carrying capacity return to debate",
      summaryEn:
        "Tourism growth and carrying capacity are back in the same sentence. Nepal wants revenue growth, but unmanaged volume can weaken safety, ecology, and visitor experience together.",
      summaryNp:
        "पर्यटन वृद्धि र वहन क्षमता फेरि एउटै बहसमा आएका छन्। आय चाहिन्छ, तर अनियन्त्रित भीडले सुरक्षा, वातावरण र अनुभव तीनैलाई कमजोर बनाउन सक्छ।",
    },
    {
      title: "Transport bottlenecks expose fragile city planning habits",
      summaryEn:
        "Urban movement problems are again revealing how fragile planning habits remain. Temporary fixes may cool frustration, but structural relief depends on sequencing, discipline, and maintenance.",
      summaryNp:
        "यातायात अवरोधले सहर योजना अझै कति कमजोर छ भन्ने देखाइरहेको छ। अस्थायी समाधानले आक्रोश घटाए पनि दिगो राहत अनुशासन, क्रमबद्धता र पूर्वाधार मर्मतमा निर्भर हुन्छ।",
    },
    {
      title: "Education policy discussions circle back to quality gaps",
      summaryEn:
        "Education coverage keeps returning to one central issue: quality. Curriculum reform, teacher support, and institutional trust still sit at the center of the debate.",
      summaryNp:
        "शिक्षा सम्बन्धी बहस फेरि एउटै मूल प्रश्नमा फर्किएको छ: गुणस्तर। पाठ्यक्रम सुधार, शिक्षक सहयोग र संस्थागत विश्वास यसैका केन्द्रमा छन्।",
    },
    {
      title: "Health service queues renew focus on system capacity",
      summaryEn:
        "Public health stories are once again less about isolated incidents and more about capacity under load. Waiting times, referral patterns, and staffing gaps signal systemic stress.",
      summaryNp:
        "सार्वजनिक स्वास्थ्यका समाचार अलग घटना भन्दा पनि प्रणालीले कति भार थेग्न सक्छ भन्ने विषयमा केन्द्रित छन्। पालो, रेफरल र जनशक्ति अभावले संरचनागत दबाब देखाउँछन्।",
    },
    {
      title: "Hydropower planning meets old questions about transmission pace",
      summaryEn:
        "The week's energy reporting suggests generation ambition still runs ahead of transmission readiness. The result is a familiar mismatch between what can be produced and what can reliably move.",
      summaryNp:
        "ऊर्जा क्षेत्रको रिपोर्टिङले उत्पादनको महत्वाकांक्षा प्रसारण तयारीभन्दा अगाडि दौडिरहेको देखाउँछ। नतिजा पुरानै हो: उत्पादन सम्भावना र विश्वसनीय वितरणबीचको असन्तुलन।",
    },
  ],
  month: [
    {
      title: "Nepal's month in review: governance, cost pressure, and public systems",
      summaryEn:
        "Seen over a month, Nepal's headline pattern is surprisingly coherent. Governance transitions, cost pressure, migration-linked economics, and public service friction keep appearing together.",
      summaryNp:
        "महिनाभर नेपालका समाचार त्यति बेतरतीब छैनन्। शासन परिवर्तन, मूल्य दबाब, वैदेशिक रोजगारीसँग जोडिएको अर्थतन्त्र र सार्वजनिक सेवाको घर्षण बारम्बार सँगै देखिन्छ।",
    },
    {
      title: "The monthly national story is capacity: state, city, and service",
      summaryEn:
        "Many separate events point toward one underlying question: capacity. Whether the topic is transport, courts, schools, or local administration, the system keeps brushing against its limits.",
      summaryNp:
        "फरक घटना अन्ततः एउटै प्रश्नमा पुग्छन्: क्षमता। यातायात, अदालत, विद्यालय वा स्थानीय प्रशासन जुनसुकै विषय होस्, प्रणाली बारम्बार आफ्नै सीमामा ठोक्किन्छ।",
    },
    {
      title: "Market anxiety and household caution define the economic mood",
      summaryEn:
        "Monthly reporting suggests businesses are balancing caution with selective optimism. Consumers remain price sensitive, while firms watch credit, imports, and demand signals with guarded attention.",
      summaryNp:
        "व्यापारिक क्षेत्र सावधानी र सीमित आशावादबीच उभिएको देखिन्छ। उपभोक्ता मूल्यप्रति संवेदनशील छन् भने व्यवसाय ऋण, आयात र मागका संकेतलाई सतर्कतापूर्वक हेर्दैछन्।",
    },
    {
      title: "Administrative delay remains the quiet headline beneath louder stories",
      summaryEn:
        "A month of coverage reveals that delay is still a hidden lead character. Files move slowly, procurement drags, and implementation loses momentum long before public attention arrives.",
      summaryNp:
        "महिनाभरका समाचारले ढिलाइ नै लुकेको मुख्य पात्र भएको देखाउँछन्। फाइल ढिलो सर्छन्, खरिद लम्बिन्छ, र कार्यान्वयन सार्वजनिक ध्यान पुग्नुअघि नै शिथिल हुन्छ।",
    },
    {
      title: "Water, roads, and urban management stay locked in a daily tug-of-war",
      summaryEn:
        "Infrastructure reporting keeps circling back to the same friction points: patchwork fixes, weak coordination, and uneven accountability. City life often becomes the scoreboard for these habits.",
      summaryNp:
        "पूर्वाधार सम्बन्धी समाचार बारम्बार उही घर्षणमा फर्कन्छन्: टालटुल समाधान, कमजोर समन्वय र असमान जवाफदेहिता। सहरको दैनिक जीवन नै यी बानीहरूको स्कोरबोर्ड बन्छ।",
    },
    {
      title: "The month's social story is expectation without patience",
      summaryEn:
        "Public expectations for faster services, cleaner cities, and more responsive institutions remain high. What the month reveals is not only demand for change, but shrinking tolerance for drift.",
      summaryNp:
        "छिटो सेवा, सफा सहर र उत्तरदायी संस्थाको सार्वजनिक अपेक्षा उच्च छ। महिनाभरको तस्वीरले परिवर्तनको माग मात्र होइन, ढिलासुस्तीप्रति घट्दो सहनशीलता पनि देखाउँछ।",
    },
  ],
}

const internationalSeeds: Record<RangeKey, { title: string; summaryEn: string; summaryNp: string }[]> = {
  day: [
    {
      title: "Energy markets react sharply to widening geopolitical risk",
      summaryEn:
        "Energy markets are reacting to fresh geopolitical tension, with implications stretching into shipping, inflation expectations, and business confidence. The real question is whether the shock fades or hardens into a longer pricing problem.",
      summaryNp:
        "ऊर्जा बजारमा नयाँ भूराजनीतिक तनावको असर देखिएको छ। यसको प्रभाव ढुवानी, मुद्रास्फीति अपेक्षा र व्यवसायिक आत्मविश्वाससम्म पुगेको छ। मुख्य प्रश्न यो हो कि यो छोटो धक्का हो कि दीर्घकालीन मूल्य समस्यामा बदलिन्छ।",
    },
    {
      title: "Migration policy debates intensify across major democracies",
      summaryEn:
        "Migration has returned to the front row of electoral politics. Governments are struggling to balance border control, labor demand, court scrutiny, and humanitarian obligations at the same time.",
      summaryNp:
        "आप्रवासन नीति फेरि चुनावी राजनीतिको अगाडिको सिटमा पुगेको छ। सरकारहरू सीमाना नियन्त्रण, श्रम माग, अदालतको निगरानी र मानवीय दायित्वबीच सन्तुलन मिलाउन संघर्ष गरिरहेका छन्।",
    },
    {
      title: "European institutions weigh new industrial resilience measures",
      summaryEn:
        "European discussions increasingly frame competitiveness as resilience. Energy security, supply continuity, and technology autonomy are becoming parts of the same economic sentence.",
      summaryNp:
        "युरोपेली बहसमा प्रतिस्पर्धात्मकतालाई अब लचिलोपनका रूपमा पनि हेरिएको छ। ऊर्जा सुरक्षा, आपूर्ति निरन्तरता र प्रविधिगत स्वायत्तता एउटै आर्थिक वाक्यका भाग बन्दै छन्।",
    },
    {
      title: "Markets parse central bank language with unusual sensitivity",
      summaryEn:
        "Investors are treating official language like weather radar. Even small changes in tone are moving expectations around borrowing, hiring, and asset pricing.",
      summaryNp:
        "बजारले केन्द्रीय बैंकको भाषालाई मौसम पूर्वानुमान जस्तै हेर्न थालेको छ। स्वरमा भएको सानो परिवर्तनले पनि ऋण, रोजगारी र सम्पत्ति मूल्य निर्धारणका अपेक्षामा असर पारिरहेको छ।",
    },
    {
      title: "Aid agencies warn that crisis fatigue is becoming a policy factor",
      summaryEn:
        "International relief coverage suggests that donor fatigue now shapes what gets funded, when, and how visibly. Humanitarian need remains high, but attention is competing with other shocks.",
      summaryNp:
        "अन्तर्राष्ट्रिय सहयोग सम्बन्धी रिपोर्टिङले दातृ थकान अब नीति निर्धारणको कारक बन्दै गएको देखाउँछ। मानवीय आवश्यकता अझै उच्च छ, तर ध्यान अन्य संकटसँग प्रतिस्पर्धामा परेको छ।",
    },
    {
      title: "Technology controls and export rules reshape strategic competition",
      summaryEn:
        "Technology policy is increasingly functioning like foreign policy. Export controls, supply chain decisions, and chip-related restrictions now carry clear geopolitical weight.",
      summaryNp:
        "प्रविधि नीति अब परराष्ट्र नीतिजस्तै काम गर्न थालेको छ। निर्यात नियन्त्रण, आपूर्ति शृंखला निर्णय र चिपसम्बन्धी प्रतिबन्धले स्पष्ट भूराजनीतिक अर्थ राख्न थालेका छन्।",
    },
  ],
  week: [
    {
      title: "Conflict, trade, and inflation remain the week's global triangle",
      summaryEn:
        "Armed conflict, trade uncertainty, and inflation sensitivity continue to collide. These may appear as separate headlines, but households and businesses feel them as one chain.",
      summaryNp:
        "द्वन्द्व, व्यापारिक अनिश्चितता र मुद्रास्फीति एकअर्कासँग जुधिरहेकै छन्। यी फरक शीर्षक जस्तो देखिए पनि व्यवसाय र परिवारले तिनलाई एउटै शृंखला जस्तै अनुभव गर्छन्।",
    },
    {
      title: "Global institutions face renewed credibility tests",
      summaryEn:
        "International institutions are again being judged on speed, legitimacy, and coordination. Trust erodes quietly, then suddenly becomes the headline itself.",
      summaryNp:
        "अन्तर्राष्ट्रिय संस्थाहरू फेरि गति, वैधता र समन्वयका आधारमा मूल्याङ्कन भइरहेका छन्। विश्वास बिस्तारै क्षीण हुन्छ र एक दिन आफैं शीर्षक बन्छ।",
    },
    {
      title: "Election calendars in multiple countries sharpen policy volatility",
      summaryEn:
        "As more countries move closer to key votes, policymaking becomes more nervous and more theatrical. Markets and diplomats alike are reading campaigns as early policy drafts.",
      summaryNp:
        "धेरै देश चुनावतर्फ नजिकिँदै जाँदा नीति निर्माण झन् बेचैन र नाटकीय बन्दै गएको छ। बजार र कूटनीतिज्ञ दुवैले अभियानलाई प्रारम्भिक नीतिगत मस्यौदाजस्तै पढिरहेका छन्।",
    },
    {
      title: "Shipping and logistics signals hint at fragile trade recovery",
      summaryEn:
        "Logistics indicators suggest that recovery remains possible but fragile. Route disruptions and cost swings are keeping global supply chains alert and slightly irritable.",
      summaryNp:
        "ढुवानी सूचकहरूले सुधार सम्भव भए पनि नाजुक रहेको संकेत दिएका छन्। मार्ग अवरोध र लागत उतारचढावले विश्व आपूर्ति शृंखला अझै अस्थिर बनाइरहेका छन्।",
    },
    {
      title: "Climate-linked events continue to test emergency planning",
      summaryEn:
        "Severe weather and climate-linked disruptions keep exposing weak preparedness. The week's lesson is familiar: risk is no longer future tense.",
      summaryNp:
        "मौसमी चरम घटना र जलवायुजन्य अवरोधले तयारीको कमजोरी उजागर गरिरहेकै छन्। यस साताको मुख्य पाठ उही हो: जोखिम अब भविष्यकाल होइन।",
    },
    {
      title: "Diplomatic language grows softer while strategic rivalry hardens",
      summaryEn:
        "Official statements may sound measured, but strategic rivalry keeps intensifying underneath the polite vocabulary. The distance between tone and reality is becoming a story of its own.",
      summaryNp:
        "आधिकारिक भाषा सौम्य सुनिए पनि रणनीतिक प्रतिस्पर्धा भित्रभित्रै कठोर बन्दै गएको छ। स्वर र वास्तविकताबीचको दूरी आफैंमा एउटा कथा बनिरहेको छ।",
    },
  ],
  month: [
    {
      title: "The world month was shaped by instability with long tails",
      summaryEn:
        "Wars, election shocks, market nerves, and institutional strain continued to produce second-order effects long after headlines moved on. Persistence, not spectacle, defines the month.",
      summaryNp:
        "युद्ध, चुनावी झट्का, बजारको बेचैनी र संस्थागत दबाब मुख्य शीर्षक हटेपछि पनि असर दिइरहे। महिनाको मूल चरित्र तमासा होइन, दीर्घ असर हो।",
    },
    {
      title: "A month of global news shows fragmentation becoming normal",
      summaryEn:
        "Trade, diplomacy, security, and technology are increasingly running on parallel tracks. Coordination is harder, and every crisis now has more ways to echo across borders.",
      summaryNp:
        "व्यापार, कूटनीति, सुरक्षा र प्रविधि अलग-अलग ट्र्याकमा अघि बढिरहेका छन्। समन्वय कठिन बन्दै गएको छ, र प्रत्येक संकट सीमापार धेरै ढंगले प्रतिध्वनित हुन्छ।",
    },
    {
      title: "Economic resilience narratives now compete with recession anxiety",
      summaryEn:
        "Governments keep telling stories of resilience, while firms and consumers remain alert to slowing demand. The mood is not collapse, but cautious motion on a thin bridge.",
      summaryNp:
        "सरकारहरूले लचिलोपनको कथा सुनाइरहेका छन्, तर व्यवसाय र उपभोक्ता घट्दो मागप्रति सतर्क छन्। अवस्था पतनको होइन, तर पातलो पुलमाथिको सावधान चालजस्तो छ।",
    },
    {
      title: "Security architecture debates are widening beyond military questions",
      summaryEn:
        "Monthly reporting shows security now extends into energy, data, ports, semiconductors, and supply routes. Strategic competition is becoming more infrastructural and less theatrical.",
      summaryNp:
        "यो महिनाको रिपोर्टिङले सुरक्षा अब केवल सैन्य विषयमा सीमित नरहेको देखाउँछ। ऊर्जा, डेटा, बन्दरगाह, अर्धचालक र आपूर्ति मार्गसमेत यसको हिस्सा बनेका छन्।",
    },
    {
      title: "The month's diplomatic story is patience under pressure",
      summaryEn:
        "Diplomacy has not become weaker so much as slower under heavier loads. When too many crises overlap, even routine negotiation begins to feel like emergency management.",
      summaryNp:
        "कूटनीति कमजोर भएको भन्दा पनि दबाबले ढिलो भएको देखिन्छ। धेरै संकट एकैचोटि हुँदा सामान्य वार्तासमेत आकस्मिक व्यवस्थापनजस्तो लाग्न थाल्छ।",
    },
    {
      title: "Global public attention keeps jumping, but structural problems stay put",
      summaryEn:
        "Attention rotates quickly from one hotspot to another, yet the underlying problems remain planted. That gap between spotlight and structure is one of the month's clearest patterns.",
      summaryNp:
        "सार्वजनिक ध्यान चाँडै एक संकटबाट अर्कोमा सर्छ, तर मूल समस्या उहीँ रहन्छ। प्रकाश र संरचनाबीचको यही दूरी महिनाको स्पष्ट ढाँचामध्ये एक हो।",
    },
  ],
}

function generateItems(range: RangeKey, bucket: BucketKey, targetCount: number): NewsItem[] {
  const seeds = bucket === "national" ? nationalSeeds[range] : internationalSeeds[range]
  const sources = sourceRegistry[bucket]

  return Array.from({ length: targetCount }, (_, index) => {
    const seed = seeds[index % seeds.length]
    const source = sources[index % sources.length]
    const variant = index + 1

    return {
      id: `${bucket}-${range}-${variant}`,
      bucket,
      title: `${seed.title}${variant <= seeds.length ? "" : ` • Update ${variant}`}`,
      source: source.name,
      sourceUrl: source.url,
      publishedAt: buildPublishedAt(range, index),
      summaryEn: `${seed.summaryEn} ${variant % 3 === 0 ? "Editors are watching policy follow-through and cross-institution coordination especially closely." : variant % 3 === 1 ? "Readers will care most about what changes on the ground, not just what is announced." : "The practical question remains whether institutions can match urgency with consistent execution."}`,
      summaryNp: `${seed.summaryNp} ${variant % 3 === 0 ? "विशेष ध्यान कार्यान्वयन र संस्थाबीचको समन्वयमा छ।" : variant % 3 === 1 ? "पाठकका लागि घोषणाभन्दा व्यवहारिक परिवर्तन नै मुख्य कुरा हुनेछ।" : "प्रमुख प्रश्न भनेको संस्थाले तत्कालता र निरन्तरता सँगसँगै दिन सक्छन् कि सक्दैनन् भन्ने हो।"}`,
    }
  })
}

function buildDemoData() {
  return {
    day: {
      national: generateItems("day", "national", 50),
      international: generateItems("day", "international", 50),
    },
    week: {
      national: generateItems("week", "national", 50),
      international: generateItems("week", "international", 50),
    },
    month: {
      national: generateItems("month", "national", 50),
      international: generateItems("month", "international", 50),
    },
  }
}

export const demoData = buildDemoData()
