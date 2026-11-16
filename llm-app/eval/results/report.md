# RAG accuracy evaluation: wildfire_literature

50 questions, each written from one abstract in the wildfire_literature collection (101,856 abstracts, all-MiniLM-L6-v2, Chroma).
Questions by `openai/gpt-4o`, answers by `anthropic/claude-sonnet-4-5`, grading by `openai/gpt-4o`. Temperature 0 throughout.

## Retrieval: did the source paper come back?

| Metric | Value |
|---|---|
| Hit@1 | 66% |
| Hit@3 (what the agent sees) | 76% |
| Hit@10 (what the Publication page shows) | 92% |
| MRR@10 | 0.73 |

## Answers: closed book vs RAG vs oracle

Correctness is graded 0/1/2 against the reference answer; *accuracy* counts a 2 as correct.

| Mode | Accuracy (score 2) | Mean score (0-2) | Abstained | Contradicts reference | Grounded in context |
|---|---|---|---|---|---|
| closed_book | 6% | 0.40 | 54% | 14% | - |
| rag_truncated | 24% | 0.80 | 44% | 0% | 100% |
| rag | 74% | 1.54 | 18% | 0% | 100% |
| oracle | 98% | 1.98 | 2% | 0% | 100% |

## Where RAG loses accuracy

| Source paper in top 3? | Questions | RAG (truncated) | RAG (full) | Oracle |
|---|---|---|---|---|
| yes | 38 | 32% | 95% | 97% |
| no | 12 | 0% | 8% | 100% |

## Per question

| # | Question | Gold rank | Closed book | RAG (truncated) | RAG (full) | Oracle |
|---|---|---|---|---|---|---|
| Q01 | What were the primary mortality agents in the current stands of whitebark pine forests on three mountains in the Lolo National Forest, Montana? | 1 | 0 | 0 | 2 | 2 |
| Q02 | What is the potential time frame for spinifex grasslands in the Western Desert to re-burn after a fire, and how long does it take for them to reach full maturity as a fuel? | 1 | 1 | 0 | 2 | 2 |
| Q03 | What factors were found to influence wildfire occurrence along high voltage power lines in Xianning, Hubei, China? | 2 | 0 | 2 | 2 | 2 |
| Q04 | What does the research suggest about Neandertal fire use during the Lower Pleniglacial in the Aquitaine Basin, southwestern France? | 2 | 1 | 1 | 1 | 2 |
| Q05 | What are the effects of thinning and prescribed burns on water yield and hydrological processes in the East Deer Creek Watershed, a subwatershed of the Colville National Forest? | 7 | 0 | 0 | 0 | 2 |
| Q06 | What impact do dynamic factors have on clearance times and exposure counts during wildfire evacuations in Victoria, Australia? | >10 | 0 | 0 | 0 | 2 |
| Q07 | What did the study find about the effectiveness of global combustion mechanisms including carbon monoxide and methane in modeling forest fire behavior? | >10 | 0 | 1 | 2 | 2 |
| Q08 | How do restoration treatments in Northern Arizona Ponderosa pine forests affect wildfire suppression costs? | 7 | 2 | 1 | 1 | 2 |
| Q09 | What was the association between a 30μg/m³ increase in BlueSky PM2.5 forecasts and respiratory health indicators in British Columbia, Canada? | 8 | 0 | 0 | 0 | 2 |
| Q10 | What was the association between bushfire smoke events and non-accidental mortality in Sydney from 1997 to 2004? | 10 | 2 | 0 | 0 | 2 |
| Q11 | What abrupt behavior was observed in the test cases for national, central/southern Rockies, and California interregional sharing of wildfire suppression resources? | 1 | 0 | 0 | 2 | 2 |
| Q12 | What effect did high-energy cosmic rays from a supernova have on tree cover in east Africa 8 million years ago? | 1 | 0 | 2 | 2 | 2 |
| Q13 | How does the synchronization of gap formation in forest patches affect the fluctuation in total biomass according to the mathematical model studied? | 1 | 0 | 0 | 2 | 2 |
| Q14 | What are the long-term effects of different oak shelterwood regeneration treatments on species diversity and oak abundance in southern Appalachian forests of North Carolina? | 1 | 1 | 1 | 1 | 1 |
| Q15 | What role does early warning play in mitigating wildfire disasters according to fire danger rating systems? | 2 | 1 | 2 | 2 | 2 |
| Q16 | How did volcanic disturbances affect the vegetation and fire regimes in the lowlands of northwestern Patagonia near Lago Pichilafquen since 14,500 cal yr BP? | 1 | 1 | 1 | 2 | 2 |
| Q17 | What is the focus of the initial phase of the Fire Information Engine Toolkit developed by the Center for Fire Research and Outreach at the University of California, Berkeley? | 2 | 0 | 2 | 2 | 2 |
| Q18 | What method is used to automatically extract burned areas from forest fires in the Daxing’anling Khanma Nature Reserve using Gaofen-1 remote sensing images, and what is the precision of this method? | 1 | 0 | 1 | 2 | 2 |
| Q19 | What is the proposed method for simulating gas phase combustion processes in wildland fires? | 1 | 0 | 2 | 2 | 2 |
| Q20 | What are the projected changes in mean annual fine litter fuel load in different ecosystems of Australia due to future climate change? | 4 | 0 | 0 | 0 | 2 |
| Q21 | What factors were found to increase fire likelihood in the lower Sonoran Desert according to the new model of fire connectivity? | 1 | 0 | 0 | 2 | 2 |
| Q22 | What were the effects of mechanical overstory reduction and slash treatment alternatives on plant cover and diversity in degraded pinyon-juniper woodlands in central New Mexico? | 1 | 1 | 0 | 2 | 2 |
| Q23 | What meteorological conditions are associated with both the ignition and development of forest fires according to the study on daily fire risk (DFR) and normalized daily fire risk (NDFR)? | 1 | 1 | 2 | 2 | 2 |
| Q24 | What is the turbulence intensity achieved in the wind tunnel designed for studying bushfire fuel combustion? | 1 | 0 | 0 | 2 | 2 |
| Q25 | What are the effects of mechanical salvage logging on soil erosion and runoff in a eucalypt stand in Portugal following a wildfire? | 1 | 0 | 1 | 2 | 2 |
| Q26 | What method was used to address inconsistency in forest fire risk mapping in Kolli Hills, India? | 4 | 0 | 0 | 0 | 2 |
| Q27 | What were the immediate effects of the Empire Fire and Island Fire on the survival and productivity of island foxes on Catalina Island? | 1 | 0 | 0 | 2 | 2 |
| Q28 | What impact did the 2003 bushfires have on water yield in ash-dominated catchments in the Murray-Darling Basin, and how does this compare to previous findings? | 1 | 0 | 1 | 2 | 2 |
| Q29 | What improvements are suggested for the hazard module of a catastrophe risk model for wildfires in the wildland–urban interface in southwest California? | 1 | 0 | 1 | 2 | 2 |
| Q30 | What were the percentages of land cover/use change associated with fire recurrence in the conversion of natural and secondary forests to pasture in the Brazilian Amazon between 2008 and 2014? | 1 | 0 | 1 | 2 | 2 |
| Q31 | How did the 2017 Canadian wildfire plume reach the tropics, and what was its impact on the Asian monsoon area? | 1 | 1 | 1 | 2 | 2 |
| Q32 | How have fire regimes changed in chestnut forests in two sites in Spain with different levels of economic development? | 1 | 0 | 1 | 2 | 2 |
| Q33 | How do the flower beetle species Protaetia morio and P. oblonga respond to wildfires in eastern Spain's Mediterranean ecosystem? | 1 | 0 | 2 | 2 | 2 |
| Q34 | What modeling techniques were used to examine fire management decisions in the southwestern United States? | 8 | 0 | 0 | 0 | 2 |
| Q35 | How does the substitution of 925-hPa temperature for 950-hPa temperature affect the calculation of the low variant of the Haines index in the central United States? | 1 | 0 | 0 | 2 | 2 |
| Q36 | What are the two regimes in the propagation of surface fires identified in the study of wildfires, and what physical mechanisms govern them? | >10 | 1 | 0 | 0 | 2 |
| Q37 | How does the legacy of harvest and fire affect carbon storage rates in mixed deciduous forests in northern lower Michigan? | 1 | 1 | 1 | 2 | 2 |
| Q38 | How did the recolonization of coleoptera fauna differ between Quercus pyrenaica ecosystems in Leon province, Spain, that were burnt in 1986 and 1989? | 1 | 0 | 2 | 2 | 2 |
| Q39 | What happens to Florida sandhill vegetation if it remains without fire for approximately 50 years? | 1 | 1 | 1 | 2 | 2 |
| Q40 | How did fire activity in the Sydney Basin change during the late Holocene, and what factors might have influenced these changes? | 1 | 0 | 1 | 2 | 2 |
| Q41 | What are the initial results of the Fire and Fire Surrogate study regarding changes in stand structure and related understory vegetation? | >10 | 2 | 0 | 0 | 2 |
| Q42 | What improvements does the Improved Giglio Algorithm for the Detection of Italian Fires (IGADIF) offer for detecting forest fires in Central and Southern Italy? | 2 | 0 | 2 | 2 | 2 |
| Q43 | How did the mean distributions of inert constituents from UAV sampling compare to the WRF/Chem 'grand truth' during the 2009 Crazy Mountain Complex wildfire in Interior Alaska? | 1 | 0 | 0 | 2 | 2 |
| Q44 | What factors contribute to mixed stakeholder support for a wildfire early warning system in Northumberland National Park, UK? | 1 | 0 | 0 | 2 | 2 |
| Q45 | What were the estimated net ecosystem production (NEP) fluxes of CO2 for areas burned during the 1988 wildfires in Yellowstone National Park? | 9 | 0 | 0 | 0 | 2 |
| Q46 | How does long-term prescribed burning affect litterfall biomass and nutrient return in a wet sclerophyll forest in southeast Queensland, Australia? | 1 | 1 | 1 | 2 | 2 |
| Q47 | What insights have recent in situ measurements provided about fire-induced turbulence regimes during low-intensity wildland fires in the New Jersey Pine Barrens? | 1 | 0 | 2 | 2 | 2 |
| Q48 | What is the correlation between the Microburst Windspeed Potential Index (MWPI) values and confirmed downburst wind speeds in the western United States during the 2014 convective season? | 1 | 0 | 0 | 2 | 2 |
| Q49 | How do prescribed burns in the oligotrophic Everglades affect periphyton biomass and fish abundance in wetland aquatic communities? | 1 | 1 | 2 | 2 | 2 |
| Q50 | What are the main features of wildfire smoke that should be considered in the assessment of public health risk? | 1 | 1 | 2 | 2 | 2 |
