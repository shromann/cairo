[![banner](https://github.com/shromann/cairo/blob/main/.github/assets/banner.gif)](https://cairo-web-964739815885.asia-southeast1.run.app/)
# Cairo: Turning Every Echocardiogram Into a Faster, Clearer Clinical Decision

> **Automate echo measurement in 2 minutes. Enable rural clinics to screen 100 patients/week without specialist oversight.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12+-3776ab.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009485.svg)](https://fastapi.tiangolo.com/)

---

## Executive thesis

Every echocardiogram contains valuable clinical information, but the workflow used to extract it is slow, labour-intensive and vulnerable to image noise, operator variability and specialist capacity constraints.

Cairo is a clinical AI platform for echocardiography. It processes echocardiography cine loops and measurements, using ECG timing when available, to:

- automate repeatable cardiac measurements;
- reduce the effect of noisy or ambiguous image data through temporal and anatomical modelling;
- render a more interpretable 3D representation of cardiac motion;
- highlight clinically relevant abnormalities and produce a ranked differential diagnosis for clinician review; and
- create a structured, auditable report that fits into the provider's existing workflow.

The commercial promise is simple:

> **Cairo helps providers convert scarce sonographer and cardiologist hours into more completed, higher-quality studies.**

This is not a replacement for a cardiologist. It is a capacity multiplier and quality-assurance layer that helps a clinical team make faster, more consistent decisions while keeping the qualified clinician in control.

---

## The patient story: a problem hiding in plain sight

An echocardiogram may take only minutes to acquire, but the work does not end when the scan is saved. A sonographer must identify usable views, repeat measurements, trace chambers and valves, reconcile inconsistent frames and prepare a report. A cardiologist then reviews the study, interprets the measurements and decides whether the findings suggest heart failure, valvular disease, cardiomyopathy or another abnormality.

The difficulty is that ultrasound is intrinsically noisy. Image quality changes with patient anatomy, acoustic windows, breathing, operator technique and motion. Two clinicians can look at the same study and spend different amounts of time deciding which frames are trustworthy and which measurements should be repeated.

The result is a capacity bottleneck:

- scarce specialists spend time on repetitive measurement and data-cleaning work;
- difficult studies receive more manual attention than routine studies;
- rural and regional providers face longer paths to specialist review;
- reporting delays can postpone treatment decisions; and
- providers cannot easily turn released staff time into additional clinical capacity because they do not know which part of the workflow is consuming it.

Australia is a strong beachhead for this problem. The Australasian Sonographers Association describes a significant and ongoing sonographer shortage across Australia and New Zealand, with delayed or limited access to ultrasound, particularly for non-acute, specialist, rural and remote services. AIHW also reports that approximately 82% of health occupations experienced shortages in 2023.

The market does not need another impressive model demo. It needs a workflow product that safely removes measurable work from a constrained clinical service.

---

## What Cairo does

### 1. Understands the study, not just a single frame

Cairo analyses the temporal information in echocardiography cine loops rather than treating each frame as an isolated image. It can use ECG gating or synchronisation when available to identify the cardiac cycle and compare equivalent phases of motion.

This matters because the clinically useful signal is often distributed across time: chamber contraction, filling, valve movement and wall motion are dynamic events. A model that understands the sequence can distinguish a transient imaging artefact from a persistent anatomical or functional pattern.

### 2. Automates measurements

Cairo produces repeatable measurements such as ejection fraction, ventricular volumes and other cardiac parameters supported by the validated model version. It provides confidence and quality signals so that low-confidence cases can be escalated for manual review rather than silently accepted.

### 3. Makes noisy data easier to interpret

The platform uses the available echo data to produce a structured, visually interpretable cardiac representation. The 3D view is not a claim that ECG alone reconstructs anatomy; it is a model-based visualisation derived from echocardiography data, with ECG providing timing information where available.

The visualisation gives clinicians a second way to inspect the study:

- measured anatomy can be shown in context;
- motion can be reviewed across the cardiac cycle;
- suspected abnormalities can be highlighted;
- the model's confidence and supporting measurements remain visible; and
- the original images remain available for comparison.

### 4. Provides differential-diagnosis support

Cairo can rank possible abnormalities and surface the findings that should receive attention. It is intended to support prioritisation and clinical reasoning, not to issue an autonomous diagnosis.

The clinician remains responsible for:

- reviewing the source images;
- accepting, editing or rejecting measurements;
- deciding whether the differential is clinically relevant; and
- signing the final report.

### 5. Fits the provider's existing system

The product should be sold as a vendor-neutral software layer that connects to existing ultrasound, DICOM/PACS, reporting and electronic medical record workflows. Providers should not need to replace their ultrasound fleet to obtain value from Cairo.

---

## Why now: the Australian market

Australia combines a high-value clinical service, workforce scarcity and a regulatory environment that is beginning to make AI-enabled medical devices more visible.

### Service economics

Medicare Benefits Schedule item 55126 lists a schedule fee of A$271.80 for an initial real-time transthoracic echocardiogram with colour-flow mapping and digital recording. This is not provider profit and does not imply that Cairo receives a separate reimbursement. It does demonstrate that each completed study represents meaningful clinical activity whose capacity and turnaround time matter to a provider.

The initial commercial case should therefore be based on:

- labour minutes removed from each study;
- additional studies completed with existing staff;
- reduced overtime or agency labour;
- fewer repeat or incomplete studies;
- faster report turnaround; and
- improved access to specialist review.

### Workforce scarcity

The ASA reports an ongoing shortage of sonographers and links it to delayed or limited access to diagnostic ultrasound, including in rural and remote settings. AIHW reports broad health-workforce shortages and difficulty filling vacancies.

This creates an unusually clear buyer problem: a provider may have demand for more echocardiograms but lack the specialist hours required to process them.

### Regulatory readiness

The Therapeutic Goods Administration's current list of AI-enabled medical devices includes Australian-market cardiac products in Class IIa and Class IIb categories, including automated ejection-fraction software, EKO AI Us2 and MyCardium EchoConfidence.

Cairo must not assume that a research prototype or a generic clinical-decision-support exemption is sufficient. A commercial plan needs a TGA intended-purpose assessment, an auditable quality-management system, local clinical evidence and a clearly bounded claim set.

---

## Competitive landscape

The competitive question is not whether AI exists in echocardiography. It does. The question is whether a provider can deploy one system that improves measurement quality, reporting speed and clinical prioritisation without being locked to one ultrasound vendor.

| Competitor or alternative | Strength | Gap Cairo can target |
|---|---|---|
| **EKO AI Us2** | Automated transthoracic echo measurements and report generation; Australian ARTG-listed products | Compete on vendor-neutral integration, transparent quality signals, local workflow evidence and a broader measurement-to-differential workflow |
| **MyCardium EchoConfidence** | Echo review, measurements and report-writing assistance; Australian ARTG-listed product | Differentiate through longitudinal model validation, explainable findings and a provider-level capacity dashboard |
| **GE HealthCare automated EF software** | Strong installed-base distribution and OEM workflow integration | Avoid machine lock-in and support mixed ultrasound fleets |
| **Echo IQ / EchoSolv** | Disease-specific decision support based on echo measurements, particularly aortic stenosis | Extend beyond a single disease and combine image quality, automated measurement and differential support |
| **Ultromics EchoGo** | Disease-specific AI for conditions such as heart failure and cardiac amyloidosis | Offer a broader workflow layer and Australia-first deployment evidence |
| **TOMTEC, Philips and other imaging workspaces** | Mature vendor-neutral or OEM-adjacent measurement and reporting workflows | Deliver a more focused AI-first experience with explicit clinical-confidence and capacity outcomes |
| **Manual workflow and outsourced reporting** | Familiar, available today and clinically trusted | Often slow, expensive to scale and dependent on scarce specialists |

### Positioning

Cairo should not position itself as “the first AI in echocardiography.” That claim is not credible in a market with existing regulated and commercial products.

The stronger position is:

> **A vendor-neutral cardiac intelligence layer that turns raw echo studies into quality-controlled measurements, an interpretable cardiac model and clinician-reviewed differential support—while measuring the operational value created for each provider.**

---

## The market gap

### Gap 1: fragmented tools instead of one workflow

Existing products tend to concentrate on one layer:

- automated ejection fraction;
- a particular disease;
- report generation;
- advanced image analysis; or
- an ultrasound manufacturer's installed base.

Providers still have to manage the hand-off between acquisition, quality control, measurement, reporting and specialist interpretation.

**Cairo's answer:** one workflow that connects the layers and leaves the original images, measurements, confidence and clinical reasoning traceable.

### Gap 2: automation without a quantified business case

Many AI products describe accuracy. Providers also need to know:

- How many minutes are saved per study?
- How many more studies can each sonographer complete?
- How much overtime is avoided?
- What percentage of AI outputs require rework?
- Does the turnaround time improve?

**Cairo's answer:** instrument the deployment so the buyer can see time saved, throughput created, quality exceptions and realised financial value.

### Gap 3: black-box results in a noisy modality

A measurement without a view of its supporting evidence is difficult to trust when image quality is variable.

**Cairo's answer:** show the source study, the model-derived cardiac representation, the measurements, confidence, detected quality limitations and the reason a case was escalated.

### Gap 4: Australia-specific access and implementation

International validation does not automatically prove that a model works across Australian sites, patient populations, ultrasound systems and workflows.

**Cairo's answer:** begin with Australian cardiology groups, public hospitals, private imaging networks and regional services; validate across multiple sites and mixed equipment; and build the evidence required for TGA and procurement.

### Gap 5: safe differential support rather than autonomous diagnosis

Providers need earlier recognition of possible abnormalities, but unsafe automation would create regulatory and clinical risk.

**Cairo's answer:** present a ranked differential and escalation recommendation as decision support, with mandatory clinician review, confidence thresholds, audit trails and a clear separation between model output and signed clinical interpretation.

---

## The provider value equation

The core commercial model is deliberately simple:

```text
Annual gross labour value
= studies per year
  x minutes saved per study / 60
  x loaded hourly rate
```

The provider's realised value is:

```text
Realised annual value
= annual gross labour value
  x capacity-realisation factor
  + avoided overtime or agency cost
  + avoided repeat-study cost
  + other measured operational benefits
```

The **capacity-realisation factor** matters. If a team saves time but cannot fill the released capacity, the value is not the same as cash savings. Cairo should therefore report both:

1. **gross capacity released**; and
2. **realised value**, based on additional completed studies, reduced overtime, shorter rosters or avoided external labour.

### Illustrative Australian site model

The following is a planning example, not a claim about every provider:

| Input | Illustrative assumption |
|---|---:|
| Annual studies | 4,400 |
| Time saved per study | 8 minutes |
| Loaded clinical labour rate | A$69/hour |
| Capacity-realisation factor | 50% |

```text
Gross capacity value
= 4,400 x 8 / 60 x A$69
= approximately A$40,600 per year

Illustrative realised value
= A$40,600 x 50%
= approximately A$20,300 per year
```

At 10,000 studies per year, the same assumptions produce approximately A$92,300 in gross annual capacity value before realisation. A provider with higher loaded rates, more minutes saved, or a greater ability to convert capacity into billable work will realise more value.

The sales process should replace these assumptions with a baseline time-and-motion study during a pilot. The first proof point is not “the model is clever”; it is:

> **This site saved X minutes per study, reduced report turnaround by Y%, and created Z hours of usable clinical capacity at an annualised value of A$N.**

---

## Product and AI/ML moat

### Product architecture

Cairo's defensible product is the combination of:

1. **Data ingestion:** secure handling of echo videos, still frames, metadata and ECG timing where available.
2. **Quality assessment:** detection of inadequate views, artefacts and low-confidence inputs.
3. **Temporal modelling:** understanding cardiac motion across the cine loop.
4. **Measurement models:** automated chamber, volume, function and other validated measurements.
5. **3D cardiac representation:** an interpretable model-based view derived from the echo data.
6. **Clinical reasoning layer:** differential support and prioritisation based on measurements, image patterns and patient context permitted by the intended use.
7. **Human review:** clinician approval, correction and override.
8. **Operational analytics:** minutes saved, rework, exceptions, turnaround and throughput.

### Why the moat is not just the model

Foundation models and published research reduce the cost of building a first prototype. The harder-to-copy assets are:

- multi-site, Australian clinical validation data;
- labelled failure cases and difficult studies;
- calibration across ultrasound vendors and protocols;
- workflow integrations;
- clinician feedback and override data;
- safety monitoring and audit infrastructure;
- regulatory documentation; and
- evidence that the product creates measurable provider value.

### Learning loop

Every reviewed study can improve the product if the provider permits appropriate use of de-identified data:

```text
study -> model output -> clinician review/override -> quality signal
      -> monitored retraining and calibration -> safer next release
```

This loop must be governed. Cairo should use versioned models, locked validation sets, drift monitoring, change control and explicit separation between development data and post-market surveillance data.

---

## Business model

### Initial buyer

The first buyer is not an individual doctor. It is the organisation that owns the capacity problem:

- private cardiology and imaging groups;
- public hospitals and health services;
- regional and rural diagnostic providers;
- telecardiology networks; and
- ultrasound service providers with multiple sites.

### Commercial packaging

A practical initial model is:

- implementation and integration fee;
- annual platform licence per site or per modality;
- usage fee per completed study; or
- a hybrid subscription with a minimum volume and a value-based expansion clause.

The price should be anchored to a conservative fraction of measured realised value, not to the theoretical value of every possible diagnosis. The provider should be able to see a credible payback period from a pilot.

### Pilot design

A 90-day pilot should establish a baseline and compare Cairo-assisted workflow with the provider's current process:

- time from acquisition to signed report;
- manual measurement time;
- number of measurement edits;
- repeat or incomplete studies;
- clinician acceptance and override rates;
- low-confidence escalation rate;
- studies completed per clinical FTE; and
- overtime, agency or outsourced reporting cost.

The pilot succeeds when it demonstrates operational value without weakening clinical safety.

---

## Regulatory and clinical trust strategy

Cairo should launch in stages rather than claim the full vision on day one.

### Stage 1: measurement and quality assurance

Focus the intended purpose on automated measurements, quality flags and clinician-reviewed structured reporting. Prove accuracy, repeatability, workflow integration and time saved.

### Stage 2: prioritisation and differential support

Add ranked possible abnormalities and referral/escalation support only after disease-specific validation. Keep the clinician in the loop and make the supporting evidence visible.

### Stage 3: regional access and longitudinal intelligence

Use validated outputs to support remote specialist review, longitudinal comparison and population-level service planning.

The regulatory plan should cover:

- TGA classification and intended-purpose review;
- ISO 13485-aligned quality management;
- ISO 14971 risk management;
- software lifecycle and cybersecurity controls;
- clinical performance evaluation in Australian sites;
- model change control and post-market surveillance;
- privacy, consent and data-governance requirements; and
- DICOM, PACS, EMR and identity-management security.

The product should never be marketed as replacing the cardiologist. Its trust proposition is stronger when it is explicit:

> **Cairo makes the routine work faster and the uncertain work more visible. The clinician makes the final decision.**

---

## Go-to-market sequence

### Beachhead

Start with private cardiology and imaging groups that have:

- meaningful echo volume;
- measurable reporting delays;
- a mixed ultrasound fleet;
- a medical director who can sponsor clinical adoption; and
- a direct incentive to increase throughput or reduce outsourced work.

### Expansion

Use the evidence from early sites to expand into:

- public hospital networks;
- regional and rural services;
- telecardiology providers;
- research and clinical-trial workflows; and
- adjacent cardiac imaging modalities.

### Sales proof points

Every commercial conversation should answer four questions:

1. How many studies does the provider perform?
2. How many minutes of specialist time does Cairo remove or reallocate?
3. What percentage of released capacity becomes realised value?
4. What evidence shows that quality and safety are maintained?

---

## Risks and mitigation

| Risk | Why it matters | Mitigation |
|---|---|---|
| Image quality is too variable | False confidence would create clinical risk | Quality gating, confidence thresholds, mandatory escalation and source-image review |
| Model performance differs by site or device | A model validated on one dataset may not generalise | Multi-site validation across vendors, protocols and patient populations |
| Clinicians do not trust the output | Low adoption destroys the business case | Explainable measurements, visible evidence, override workflows and local champions |
| AI saves time but not money | Released capacity may not become cash savings | Measure realisation, throughput, overtime and external labour separately |
| Regulatory scope expands with differential diagnosis | More ambitious claims increase evidence burden | Stage claims: measurement first, disease-specific support after validation |
| Incumbents bundle AI into ultrasound contracts | OEM pricing and distribution are powerful | Stay vendor-neutral, integrate with installed systems and sell measurable workflow outcomes |
| Data governance slows deployment | Clinical data is sensitive and distributed | Secure architecture, Australian hosting options, de-identification and explicit governance |

---

## The investor story in one minute

Healthcare providers already own the ultrasound machines and already have demand for echocardiography. Their constraint is the scarce human time required to turn noisy images into trusted measurements and a signed clinical report.

Cairo is the intelligence layer between the scan and the decision. It uses AI and machine learning to understand cardiac motion, automate measurements, make uncertainty visible and show clinicians an interpretable cardiac model with ranked differential support. It integrates with existing workflows rather than asking providers to replace their equipment.

The business case is measurable at every site:

```text
hours released = studies x minutes saved / 60
provider value = hours released x loaded rate x realised capacity
```

Our first product is not autonomous diagnosis. It is safer, faster, more consistent echocardiography. Once the workflow is trusted and the provider value is proven, Cairo can expand from measurement automation into disease-specific decision support, remote access and longitudinal cardiac intelligence.

> **Cairo does not sell an algorithm. It sells clinical capacity, clearer decisions and measurable economic value.**

---

## Sources and diligence notes

The following sources support the market framing and should be re-checked as part of formal diligence:

- Therapeutic Goods Administration, [AI-enabled medical devices included on the ARTG](https://www.tga.gov.au/products/medical-devices/software-and-artificial-intelligence-ai/manufacturing/artificial-intelligence-ai-and-medical-device-software-regulation/ai-enabled-medical-devices-artg), accessed 14 September 2026.
- Therapeutic Goods Administration, [TGA focuses on compliance for AI and software-based medical devices](https://www.tga.gov.au/news/news-articles/tga-focuses-compliance-ai-and-software-based-medical-devices), accessed 14 September 2026.
- Therapeutic Goods Administration, [Clinical decision support system exemption amendments](https://www.tga.gov.au/news/news-articles/clinical-decision-support-system-exemption-amendments), accessed 14 September 2026.
- Australasian Sonographers Association, [Workforce Australia](https://www.sonographers.org/advocacy/workforce), accessed 14 September 2026.
- Australian Institute of Health and Welfare, [Health workforce](https://www.aihw.gov.au/reports/workforce/health-workforce), accessed 14 September 2026.
- Australian Institute of Health and Welfare, [Hospitals at a glance](https://www.aihw.gov.au/hospitals/overview/hospitals-at-a-glance), accessed 14 September 2026.
- Australian Government Department of Health and Aged Care, [MBS item 55126](https://www9.health.gov.au/mbs/fullDisplay.cfm?type=item&qt=ItemID&q=55126), accessed 14 September 2026.
- EKO AI, [Echo AI / Us2](https://echoai.com/), accessed 14 September 2026.
- Echo IQ, [Echo IQ](https://echoiq.ai/), accessed 14 September 2026.
- Ultromics, [EchoGo Heart Failure](https://www.ultromics.com/echogo-heart-failure), accessed 14 September 2026.
- TOMTEC, [Products](https://www.tomtec.de/products/), accessed 14 September 2026.
- Circle Cardiovascular Imaging, [cvi42](https://www.circlecvi.com/cvi42), accessed 14 September 2026.

### Important diligence notes

- Competitor capabilities, regulatory status, pricing and geographic availability change frequently. Confirm each claim directly with the vendor, the TGA and procurement documentation before using this document in an investment process.
- The Australian market does not appear to have one authoritative public dataset for national echocardiography volumes, echo waiting times or sonographer-specific labour rates. The provider value examples in this document are illustrative assumptions, not market-wide facts.
- The loaded hourly rate and capacity-realisation factor must be replaced with site-specific data before presenting a return-on-investment commitment.
- A 3D cardiac representation must be described accurately as derived from echocardiography data, with ECG used for timing or synchronisation where available. ECG alone does not provide sufficient anatomical information to reconstruct a 3D heart.
- Any commercial clinical claim requires appropriate Australian clinical validation, quality management, cybersecurity, privacy controls and TGA strategy.
---

## Contributors

| Role | GitHub |
|------|--------|
| Frontend | [@LucidMach](https://github.com/LucidMach) |
| Backend / Infra | [@GVivek-7](https://github.com/GVivek-7) |
| Backend / Infra | [@vaibhav-reddy-a](https://github.com/vaibhav-reddy-a) |
| Backend / Infra | [@hariharas-wq](https://github.com/hariharas-wq) |
| Lead / Model | [@shromann](https://github.com/shromann) |

---

## Citation

If you use Cairo in research, please cite:

```bibtex
@software{cairo2026,
  author = {Majumder, Shromann and Vivek, G},
  title = {Cairo: Open-Source AI for Echocardiography Measurement},
  year = {2026},
  url = {https://github.com/shromann/cairo}
}
```

---

## Roadmap

- ✅ v0.1.0 (Jan 2026): LV measurement (EF, volumes)
- 🚧 v0.2.0 (Q2 2026): 40+ additional cardiac tasks (RV, strain, diastolic)
- 🚧 v0.3.0 (Q3 2026): DICOM input/output; EHR integration (HL7/FHIR)
- 🚧 v1.0.0 (Q4 2026): FDA 510(k) clearance; commercial deployment
- 🚧 v2.0.0 (2027+): AI consult platform; federated learning for continuous improvement

---

## Acknowledgments

- **PanEcho Model:** Yale University (CarDS Lab) for pre-trained multi-task learning model
- **Clinical Advisors:** Cardiologists and sonographers who validated the approach
- **Open Source:** FastAPI, SQLAlchemy, PyTorch, GCP

---

[Public Codebase](https://github.com/shromann/cairo/tree/main) · [Production URL](https://cairo-web-964739815885.asia-southeast1.run.app/) · [3–5 Minute Demo Video](https://youtu.be/1Ryanly4SNo?si=iOK1puGsSHfi2yL3)
