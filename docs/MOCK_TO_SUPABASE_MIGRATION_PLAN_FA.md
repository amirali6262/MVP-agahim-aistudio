# برنامه حذف کامل Mock و انتقال داده‌ها به Supabase

## هدف و خط قرمزها

هدف نهایی این برنامه، حذف کامل `frontend/lib/mockDb.ts` و تمام importها، fallbackها و داده‌های نمایشی وابسته به آن است؛ نه صرفاً خالی کردن آرایه‌های این فایل. پس از اجرا:

- Supabase تنها منبع حقیقت برنامه است.
- خطای شبکه، خطای مجوز یا خالی بودن جدول هرگز با داده ساختگی جایگزین نمی‌شود.
- frontend فقط loading، empty state یا error واقعی نشان می‌دهد.
- داده‌های نمونه production وارد migrationهای schema نمی‌شوند.
- fixtureهای تست فقط در تست‌های rollback-only یا seed صریح محیط local باقی می‌مانند و وارد برنامه production نمی‌شوند.

این سند فقط برنامه اجراست و در این مرحله هیچ schema، داده یا کد اجرایی تغییر داده نمی‌شود.

## ۱. موجودی داده‌هایی که اکنون در Mock هستند

### ۱.۱ داده‌های موجود در `mockDb.ts`

| حوزه | مجموعه Mock فعلی | مقصد Supabase | وضعیت مقصد |
|---|---|---|---|
| اعتراض | `_objectionTemplates` | `objection_templates`، `objection_stages`، transition/overrideهای وابسته | بخشی موجود؛ تطبیق دقیق لازم است |
| تمدید مهلت | `_deadlineExtensions` | مدل deadline/circular موجود یا جدول مستقل extension | تصمیم مدل و migration لازم است |
| تعهدات قدیمی | `_obligations` | `obligations`، `obligation_versions`، `obligation_version_penalties` و workflow | جداول هسته موجود؛ mapper لازم است |
| شرکت‌ها | `_tenants` | `tenants` | موجود |
| اعضای شرکت | `_userTenants` | `user_tenants` | موجود |
| انجام تکلیف | `_fulfillments` | case/task/event یا جدول fulfillment مستقل | شکاف مدل باید تعیین شود |
| دفاتر تجاری | `_commercialBookPeriods` | جدول‌های commercial-book period و tenant submission | migration لازم است |
| چک‌لیست | `_checklistTemplates` و `_tenantChecklistProgress` | template/version/section/item/progress | migration لازم است |
| سال مالی | `_tenantFiscalYears` | tenant fiscal years | migration یا تطبیق با profile لازم است |
| اظهارنامه عملکرد | `_corporateTaxFilings` | filing/submissionهای عملکرد | migration لازم است |
| اظهارنامه VAT | `_vatTaxFilings` | filing/submissionهای ارزش افزوده | migration لازم است |
| استودیوی تعهدات | `_studioFamilies`، `_studioObligations`، `_studioVersions` | `obligation_families`، `obligations`، `obligation_versions` | موجود |
| قواعد مشمولیت | `_studioRuleSets`، `_studioConditions` | `eligibility_rule_sets`، `eligibility_conditions` | موجود |
| گردش کار | `_studioTemplates`، `_studioSteps` و transitionها | `workflow_templates`، `workflow_steps`، `workflow_transitions` | موجود |
| بخشنامه | داده‌های داخل `mockStudioDb` | `legal_circulars` و deadlineهای مرتبط | موجود |

### ۱.۲ داده‌های Mock خارج از `mockDb.ts`

این موارد نیز باید در همان پروژه حذف شوند؛ در غیر این صورت خالی کردن `mockDb.ts` به هدف نمی‌رسد:

- سوابق ماهانه بیمه و قراردادهای ماده ۳۸ در `CompanyInsurance.tsx`؛
- پرونده `case-demo-1` و fallback بخشنامه در `AdminCircularCenter.tsx`؛
- مقادیر نمایشی و عملیات فقط in-memory در صفحات دفاتر تجاری؛
- ماژول‌های دائماً فعال Demo در `AdminSidebar.tsx`؛
- جلسه آزمایشی `mockAuth.ts`؛
- fallbackهای Studio V2/V3/V4 و سایر صفحه‌هایی که مستقیماً `mockDb` را import می‌کنند.

### ۱.۳ داده‌های Seed داخل migrationها

پیش از انتقال باید این سه نوع از هم جدا شوند:

1. **داده مرجع معتبر production:** فقط با منبع، نسخه، تاریخ اثر، مالک محتوا و تأیید حقوقی وارد Supabase شود.
2. **داده نمایشی:** از migration production خارج و در seed صریح محیط local نگهداری شود.
3. **fixture تست:** فقط داخل transaction تست ساخته و rollback شود.

فایل‌های seed مالیات عملکرد و نمونه مالیات اشخاص حقوقی باید رکوردبه‌رکورد طبقه‌بندی شوند؛ انتقال کورکورانه همه محتوای Mock به production مجاز نیست.

## ۲. تصمیم‌های لازم پیش از نوشتن migration

### ۲.۱ تعیین مالک و اعتبار داده

برای هر رکورد Mock یک manifest تهیه می‌شود که شامل این ستون‌هاست:

- شناسه و حوزه؛
- `REFERENCE`، `DEMO` یا `TEST`؛
- منبع رسمی و URL؛
- تاریخ شروع/پایان اعتبار؛
- مسئول کسب‌وکار و تأییدکننده حقوقی؛
- مقصد جدول و تبدیل فیلدها؛
- تصمیم `MIGRATE`، `REWRITE` یا `DROP`.

فقط رکوردهای `REFERENCE` تأییدشده وارد production می‌شوند. داده‌هایی مانند نام شرکت نمونه، شماره پیگیری، مبلغ قرارداد و پرونده demo نباید به production منتقل شوند؛ برای این‌ها schema واقعی ساخته می‌شود ولی رکورد نمونه حذف می‌گردد.

### ۲.۲ تثبیت مدل دامنه

پیش از تغییر frontend باید برای حوزه‌های فاقد جدول، مدل نهایی تصویب شود:

- دفاتر تجاری: template/period/deadline/submission/attachment؛
- چک‌لیست: template/version/section/item و progress هر tenant؛
- سال مالی و اظهارنامه عملکرد/VAT؛
- بیمه ماهانه و قرارداد ماده ۳۸؛
- fulfillment عمومی در برابر case/task/event؛
- extension مستقل در برابر تغییر deadline با circular.

هر جدول باید `tenant_id` یا مالک پلتفرمی روشن، RLS، audit fields، constraint، index و سیاست حذف داشته باشد.

### ۲.۳ سیاست شناسه و نسخه‌بندی

- UUIDهای Mock مبنای کلید production نمی‌شوند، مگر اینکه از قبل در migration رسمی و پایدار استفاده شده باشند.
- داده حقوقی و templateها versioned و رکورد منتشرشده immutable هستند.
- داده tenant با FK واقعی به `auth.users`/`public.users` و `tenants` وارد می‌شود.
- فایل‌ها در Storage خصوصی ذخیره می‌شوند؛ Data URL یا base64 در جدول قرار نمی‌گیرد.

## ۳. ترتیب اجرای پیشنهادی

### فاز صفر — Baseline و حفاظ ایمنی

1. گرفتن backup و ثبت تعداد رکوردهای تمام جدول‌های مقصد در هر محیط.
2. تولید دوباره `database.types.ts` از schema واقعی و افزودن drift check به CI.
3. تهیه dependency matrix از تمام importهای `mockDb` و routeهای مصرف‌کننده.
4. افزودن تستی که در build production وجود `mockDb`، `mockAuth`، `case-demo` و fixtureهای شناخته‌شده را رد کند.
5. تعریف feature flag موقت برای هر حوزه؛ flag صرفاً route را می‌بندد و اجازه fallback نمی‌دهد.

**معیار خروج:** فهرست مصرف‌کنندگان کامل، backup قابل بازیابی و baseline قابل مقایسه موجود باشد.

### فاز یک — تکمیل schema و RLS

1. ایجاد migrationهای schema برای حوزه‌های فاقد جدول، بدون seed نمایشی.
2. تعریف RLS بر مبنای tenant membership و نقش‌های پلتفرمی.
3. ایجاد RPC برای mutationهای چندمرحله‌ای، انتشار، upload metadata و عملیات حساس.
4. افزودن constraintهای تاریخ، وضعیت، uniqueness و FK.
5. نوشتن تست SQL برای owner/admin/member/outsider/platform roles و cross-tenant isolation.

**معیار خروج:** `supabase db reset`، lint دیتابیس و تمام تست‌های RLS روی دیتابیس disposable سبز باشند.

### فاز دو — پاک‌سازی و ورود داده معتبر

1. manifest داده تکمیل و توسط مالک دامنه/حقوقی امضا شود.
2. رکوردهای معتبر Mock به قالب import versioned تبدیل شوند.
3. import در staging اجرا و تعداد، FK، checksum و نمونه‌های تصادفی کنترل شوند.
4. اجرای دوباره import باید idempotent باشد و duplicate نسازد.
5. پس از تأیید staging، فقط داده مرجع معتبر در production وارد شود.
6. شرکت‌ها، اعضا، filingها، قراردادها و کدهای پیگیری نمونه حذف شوند و هرگز به production import نشوند.

**معیار خروج:** گزارش reconcile برای هر مجموعه شامل source count، inserted، updated، rejected و checksum صفر اختلاف غیرمنتظره داشته باشد.

### فاز سه — لایه دسترسی Supabase در frontend

برای جلوگیری از تکرار منطق، ابتدا repositoryهای domain ساخته می‌شوند:

- `CatalogRepository`؛
- `EligibilityRepository`؛
- `WorkflowRepository`؛
- `CircularDeadlineRepository`؛
- `ObjectionRepository`؛
- `CommercialBooksRepository`؛
- `ChecklistRepository`؛
- `FiscalFilingRepository`؛
- `InsuranceRepository`؛
- `TenantRepository`.

هر repository فقط type تولیدشده Supabase یا DTO صریح برمی‌گرداند. `as any`، mutation مستقیم object، و fallback به آرایه محلی مجاز نیست. برای queryها loading/empty/error و برای commandها success/failure واقعی تعریف می‌شود.

**معیار خروج:** repositoryها دارای تست success، empty، unauthorized، network failure و validation failure باشند.

### فاز چهار — مهاجرت صفحه‌به‌صفحه

ترتیب کم‌ریسک به پرریسک:

1. Tenant و membership؛
2. کاتالوگ، family، obligation و version؛
3. eligibility و workflow؛
4. circular/deadline/extension؛
5. objection؛
6. checklist و commercial books؛
7. fiscal years و filingهای عملکرد/VAT؛
8. insurance و قرارداد ماده ۳۸؛
9. fulfillment/case/task و داشبوردها.

برای هر صفحه این چرخه تکرار می‌شود:

1. query/mutation به repository منتقل شود؛
2. import مستقیم Mock حذف شود؛
3. fallbackهای catch و success کاذب حذف شوند؛
4. empty/error state فارسی و قابل اقدام اضافه شود؛
5. تست component و E2E نوشته شود؛
6. feature flag همان حوزه در staging باز شود؛
7. telemetry و خطاها یک دوره پایش شوند؛
8. سپس flag production باز شود.

### فاز پنج — حذف نهایی Mock

پس از صفر شدن مصرف‌کنندگان:

1. حذف Studio V2/V3 و نگه‌داشتن فقط نسخه فعال؛
2. حذف همه importهای `mockDb` و `mockAuth`؛
3. حذف `VITE_ENABLE_MOCK_DATA` و `VITE_ENABLE_MOCK_AUTH` از env و مستندات؛
4. حذف `frontend/lib/mockDb.ts` و `frontend/lib/mockAuth.ts`، نه نگه‌داشتن فایل خالی؛
5. حذف `DEMO_MODULES_ENABLED`، `case-demo-*` و آرایه‌های hard-coded componentها؛
6. اجرای جست‌وجوی نهایی Mock/Demo/Sample/Fixture و بازبینی دستی نتایج مجاز (placeholder و تست)؛
7. enforce کردن ممنوعیت import Mock و fixture production در CI.

**معیار خروج:** `rg` هیچ مرجع runtime به Mock/Demo نشان ندهد و bundle production فاقد داده‌های آزمایشی باشد.

## ۴. قواعد migration و rollback

- تغییر schema، backfill داده و تغییر frontend در PRهای جدا ولی ترتیبی انجام شوند.
- ابتدا migration سازگار با نسخه قبلی deploy شود؛ سپس frontend جدید؛ حذف ستون/کد قدیمی فقط در release بعدی.
- هر backfill دارای dry-run، transactionهای محدود، log تعداد و اسکریپت reconcile باشد.
- rollback داده به معنای restore رکوردهای قبلی است، نه صرفاً down migration؛ پیش از production تمرین شود.
- رکوردهای حقوقی منتشرشده update مخرب نمی‌شوند؛ نسخه جدید ساخته می‌شود.
- هیچ migration به «اولین platform admin موجود» وابسته نباشد.

## ۵. تست‌های پذیرش نهایی

### داده و امنیت

- تست RLS برای تمام جدول‌های جدید و تمام نقش‌ها؛
- تست جلوگیری از cross-tenant read/write؛
- تست immutable بودن نسخه منتشرشده؛
- تست idempotency import و RPC؛
- reconcile تعداد و checksum داده staging/production.

### frontend

- قطع شبکه باید error نشان دهد، نه داده نمونه؛
- پاسخ خالی باید empty state نشان دهد؛
- خطای RPC نباید toast موفقیت یا state منتشرشده ایجاد کند؛
- reload مرورگر باید داده ذخیره‌شده Supabase را حفظ کند؛
- route و actionها باید با permission واقعی هماهنگ باشند؛
- E2E مسیرهای tenant، obligation، filing، objection و admin publish.

### بررسی حذف Mock

```bash
rg -n "mockDb|mockAuth|VITE_ENABLE_MOCK|case-demo|DEMO_MODULES_ENABLED" frontend
rg -n -i "mock|demo|sample|fixture|آزمایشی|نمونه" frontend --glob '*.{ts,tsx}'
npm run lint
npm run build
```

خروجی جست‌وجوی دوم باید دستی طبقه‌بندی شود؛ واژه‌های موجود در متن راهنما یا placeholder لزوماً داده آزمایشی نیستند، اما هیچ fixture یا fallback runtime مجاز نیست.

## ۶. تقسیم PRهای اجرایی

1. **PR-1:** inventory نهایی، manifest، CI guard و تولید type؛
2. **PR-2:** schema/RLS حوزه‌های دفاتر، checklist و fiscal؛
3. **PR-3:** schema/RLS بیمه و fulfillment؛
4. **PR-4:** پاک‌سازی seedها و import داده مرجع در staging؛
5. **PR-5:** repositoryهای هسته و مهاجرت Tenant/Catalog/Workflow؛
6. **PR-6:** Circular/Deadline/Objection؛
7. **PR-7:** Books/Checklist/Fiscal/Insurance؛
8. **PR-8:** حذف success کاذب، تکمیل E2E و observability؛
9. **PR-9:** حذف کامل `mockDb.ts`، `mockAuth.ts`، flagها و Studioهای قدیمی.

هیچ PR نباید هم‌زمان schema چند حوزه، backfill production و بازنویسی گسترده UI را انجام دهد. هر PR باید migration، RLS test، برنامه rollback و نتیجه reconcile مربوط به همان حوزه را داشته باشد.

## ۷. تعریف پایان کار

کار زمانی تمام است که:

- فایل‌های `mockDb.ts` و `mockAuth.ts` وجود نداشته باشند؛
- هیچ داده hard-coded کسب‌وکاری در componentها وجود نداشته باشد؛
- همه صفحات فقط از Supabase repository بخوانند و در آن بنویسند؛
- هیچ catch به داده یا موفقیت محلی fallback نکند؛
- همه داده‌های مرجع production دارای منبع و تأیید باشند؛
- همه داده‌های tenant واقعی به tenant و user واقعی متصل و تحت RLS باشند؛
- migrationهای production فاقد seed نمایشی باشند؛
- تست‌های SQL، component و E2E و build production سبز باشند؛
- جست‌وجوی نهایی و بررسی bundle نبود fixture runtime را تأیید کند.
