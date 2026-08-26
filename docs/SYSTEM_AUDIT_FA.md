# گزارش ممیزی معماری، کیفیت و داده‌های آزمایشی آگاهیم

**تاریخ ممیزی:** ۱۴۰۵/۰۶/۰۴ (۲۰۲۶-۰۸-۲۶)  
**دامنه:** تمام ۱۳۴ فایل نسخه‌بندی‌شده مخزن (حدود ۴۲ هزار خط)، به‌جز وابستگی‌های تولیدشده در `node_modules` و متادیتای داخلی Git  
**روش:** مرور ساختار و فایل‌های منبع، جست‌وجوی سراسری الگوهای Mock/Seed/Fixture/Secret/TODO، بررسی مسیرهای احراز هویت و دسترسی، مرور migrationها و تست‌های SQL، TypeScript check، build تولید و audit وابستگی‌ها.

> این گزارش یک ممیزی ایستا از مخزن است، نه تأیید حقوقی محتوای مالیاتی و نه تست نفوذ محیط عملیاتی. برای تأیید نهایی RLS باید تست‌های دیتابیس روی Supabase محلی/مجزا نیز اجرا شوند.

## ۱. جمع‌بندی مدیریتی

محصول از نظر **مدل امنیت دیتابیس و تفکیک Tenant** پایه‌ای جدی‌تر از یک MVP معمولی دارد: RLS، RPCهای محدود، قفل نسخه منتشرشده، migrationهای ترتیبی و تست‌های rollback-only نقاط قوت مهم‌اند. معماری فعلی Modular Monolith برای مرحله محصول مناسب است و CI نیز build، type-check، dependency audit، secret scanning و تست‌های امنیت دیتابیس را پوشش می‌دهد.

با این حال، برنامه هنوز برای نمایش بدون ابهام به‌عنوان سامانه production آماده نیست. ریسک اصلی، **مخلوط شدن مسیر واقعی و آزمایشی** است: در نبود پیکربندی Supabase، Mock به‌طور خودکار فعال می‌شود؛ چند صفحه حتی در خطای شبکه یا خالی بودن پاسخ واقعی به داده ساختگی برمی‌گردند؛ بعضی عملیات ناموفق نیز پیام موفقیت نشان می‌دهند. علاوه بر آن، بخش‌هایی مثل بیمه و دفاتر تجاری کاملاً in-memory هستند، فایل‌های چند هزار خطی و نسخه‌های موازی Studio هزینه نگهداری بالایی ایجاد کرده‌اند، backend واقعی وجود ندارد و برای frontend تست خودکار دیده نمی‌شود.

**حکم کلی:** پایه دیتابیس و امنیت «امیدوارکننده»، اما مرز Demo/Production و صداقت وضعیت عملیات «بحرانی» است. تا رفع موارد P0، داده نمایش‌داده‌شده یا پیام موفقیت نباید به‌عنوان واقعیت عملیاتی تلقی شود.

## ۲. تصویر معماری فعلی

### اجزا

- **Frontend:** React 18 + TypeScript + Vite، رابط RTL فارسی، React Router، Tailwind/Radix و Supabase JS.
- **Backend کاربردی:** پوشه `backend` فقط یک `package.json` خالی دارد؛ منطق سمت سرور عملاً در PostgreSQL/Supabase (RLS، trigger و RPC) است.
- **Data/Auth:** Supabase Auth و PostgreSQL؛ مدل multi-tenant، کاتالوگ تعهدات، workflow، eligibility، case/task، deadline/circular و review workflow با migrationها ساخته شده‌اند.
- **حالت Demo:** `mockAuth.ts` و یک دیتابیس in-memory بسیار بزرگ در `mockDb.ts`؛ بعضی componentها نیز داده سخت‌کدشده مستقل دارند.
- **Delivery:** GitHub Actions برای build/type-check/audit/secret scan، تست امنیت دیتابیس و deployment migration.

### جریان اعتماد پیشنهادی موجود

مرورگر با publishable key به Supabase متصل می‌شود؛ Auth هویت را می‌سازد، RLS خواندن را محدود می‌کند و mutationهای حساس از RPCهای `SECURITY DEFINER` با validation و role check عبور می‌کنند. این الگو در اصل مناسب است، به شرط آنکه UI خطا را پنهان نکند و هیچ عملیات privileged به update مستقیم و fallback موفق‌نما تنزل نکند.

## ۳. نقاط قوت

### ۳.۱ امنیت دیتابیس و جداسازی Tenant

1. migrationهای متعدد برای قفل کردن default privilege، helperهای RLS، جلوگیری از افزایش نقش و جلوگیری از دسترسی cross-tenant وجود دارد.
2. ساخت Tenant و مالک نخست با RPC اتمیک انجام می‌شود و حالت ownerless محدود شده است.
3. mutationهای حساس به RPC محدود شده‌اند؛ برای functionها `search_path` و grant/revoke به‌طور صریح مدیریت شده است.
4. نسخه‌های منتشرشده، ruleها و workflowها در سطح دیتابیس در برابر تغییر مستقیم محافظت می‌شوند.
5. تست‌های SQL نقش‌های owner/admin/member/outsider/platform admin، انتشار، دسترسی case و یکپارچگی circular/deadline را با transaction و rollback بررسی می‌کنند.

### ۳.۲ مدل دامنه نسبتاً غنی

- مفاهیم مهم محصول—تعهد، نسخه قانونی، مشمولیت توضیح‌پذیر، workflow، transition، case، task، deadline، notification، جریمه و اعتراض—به‌صورت موجودیت‌های مستقل مدل شده‌اند.
- lifecycle پیش‌نویس/بازبینی/آزمایش/انتشار و قفل پس از انتشار، با ماهیت محتوای حقوقی سازگار است.
- تاریخچه و audit در چند بخش دیده شده و برای تصمیم‌های قانونی ضروری است.

### ۳.۳ کیفیت تحویل و عملیات

- CI هم build و type-check و هم audit و secret pattern scan دارد.
- Actionهای خارجی تا حد زیادی با commit SHA pin شده‌اند و سطح دسترسی workflowها `contents: read` است.
- deployment migration، dry-run، تأیید دستی برای apply و parity check دارد.
- `.env`ها ignore شده‌اند و نمونه env فقط متغیرهای client-safe را معرفی می‌کند؛ در جست‌وجوی مخزن credential واقعی مشاهده نشد.

### ۳.۴ تجربه کاربری پایه

- RTL، تاریخ جلالی، loading state، error boundary، toast و route guard وجود دارد.
- مسیر ورود مدیر و کاربر جداست و بازیابی رمز عبور در مستندات دیده شده است.
- انتخاب Tenant پیش از ورود به صفحات شرکت، مانع کار در context نامشخص می‌شود.

## ۴. نقاط ضعف، ریسک و راهکار

### P0 — پیش از هر انتشار production

#### ۴.۱ نشت داده آزمایشی به تجربه واقعی

**شاهد:** `isMockDataEnabled` در صورت نبود تنظیم Supabase خودکار true می‌شود. Studio و Circular Center در خطای شبکه، response خالی یا exception به Mock برمی‌گردند. این یعنی خرابی production می‌تواند به‌جای خطای واضح، اطلاعات ساختگی معتبرنما نشان دهد.

**پیامد:** تصمیم حقوقی/مالی بر اساس داده غیرواقعی، پنهان شدن outage، و از بین رفتن اعتماد کاربر.

**راهکار:**

1. Mock فقط با شرط هم‌زمان `import.meta.env.DEV && VITE_ENABLE_MOCK_DATA === 'true'` فعال شود؛ نبود config در production باید fail-closed باشد.
2. import مستقیم `mockDb` از componentهای production حذف و یک `Repository` interface با دو adapter مستقل (`SupabaseRepository` و `DemoRepository`) ساخته شود.
3. انتخاب adapter فقط در composition root انجام شود؛ fallback در catch مطلقاً ممنوع باشد.
4. در Demo یک banner دائمی و watermark «داده آزمایشی — ذخیره نمی‌شود» نمایش داده شود.
5. CI یک build production بسازد و با جست‌وجوی bundle، جلوگیری از ورود mock fixtureها را enforce کند.

#### ۴.۲ اعلام موفقیت کاذب پس از خطای backend

**شاهد:** در Circular Center خطای RPC انتشار با update مستقیم دنبال می‌شود؛ خطای scheduler پیام موفقیت می‌دهد و catch انتشار نیز state محلی را منتشرشده نشان می‌دهد.

**پیامد:** اپراتور تصور می‌کند اعلان یا انتشار انجام شده، در حالی که transaction یا authorization شکست خورده است.

**راهکار:** فقط پاسخ موفق RPC منبع حقیقت باشد؛ update مستقیم fallback حذف شود؛ error دارای correlation id نمایش داده شود؛ state پس از mutation از server refetch شود؛ برای هر command تست failure-path نوشته شود.

#### ۴.۳ داده seed حقوقی/عملیاتی در migration تولید

**شاهد:** دو migration جدید داده workflow مالیات عملکرد، actorها، document typeها، منابع حقوقی و تعطیلات ناقص (`_sample - should be complete`) وارد می‌کنند. migration نمونه مالیات اشخاص حقوقی نیز در صورت وجود platform admin رکورد Draft می‌سازد.

**پیامد:** داده نمونه وارد هر محیطی که migration را اعمال کند می‌شود؛ محتوای ناقص ممکن است به‌عنوان مرجع رسمی استفاده شود؛ migration به وجود/انتخاب کاربر ادمین وابسته می‌شود و deterministic نیست.

**راهکار:** seed demo از migration schema جدا و در `supabase/seed.sql` یا fixture محیط local قرار گیرد؛ داده مرجع production فقط پس از مالک داده، منبع رسمی، تاریخ اثر و review حقوقی وارد شود؛ migrationها deterministic و مستقل از اولین admin باشند؛ تعطیلات ناقص قبل از استفاده در deadline engine تکمیل و نسخه‌دار شود.

#### ۴.۴ نقش‌های مدیریتی بیش از معنای route

**شاهد:** `requireRole="PLATFORM_ADMIN"` در `ProtectedRoute` عملاً نقش‌های MANAGER/REGISTRAR/REVIEWER/APPROVER را هم admin مجاز می‌داند.

**پیامد:** نام API گمراه‌کننده است و ممکن است صفحه‌ای که واقعاً platform-admin-only فرض شده به نقش‌های دیگر نمایش داده شود. RLS/RPC ممکن است جلوی mutation را بگیرد، اما exposure و خطای UX باقی است.

**راهکار:** guard بر مبنای permission (`catalog.read`, `catalog.publish`, `access.manage`) نه نام role؛ تعریف policy مرکزی؛ تست ماتریس route × role؛ و هماهنگی دقیق UI permission با RPC authorization.

### P1 — تثبیت معماری و کیفیت

#### ۴.۵ ماژول‌های کاملاً in-memory و داده سخت‌کدشده

- بیمه ماهانه و قراردادهای ماده ۳۸ داخل state component با نام شرکت، مبلغ و کد رهگیری نمونه هستند.
- دفاتر تجاری admin مستقیماً از `mockCommercialBooksDb` می‌خواند/می‌نویسد و upload را به Data URL حافظه تبدیل می‌کند.
- sidebar با `DEMO_MODULES_ENABLED = true` ماژول‌های نمایشی را همیشه نشان می‌دهد.

**راهکار:** این routeها تا اتصال واقعی با feature flag production خاموش شوند؛ سپس schema/RLS/repository و Storage bucket خصوصی با signed URL، محدودیت MIME/size و malware scanning طراحی شود. داده in-memory تنها در Storybook/test fixture باقی بماند.

#### ۴.۶ فایل‌های بسیار بزرگ و نسخه‌های موازی

`AdminComplianceStudioV4.tsx` بیش از چهار هزار خط، `mockDb.ts` بیش از دو هزار خط و Studioهای V2/V3/V4 هم‌زمان نگهداری می‌شوند. منطق query، mutation، mapping و UI در یک فایل مخلوط است.

**پیامد:** regression، conflict، تست‌ناپذیری، bundle بزرگ و کندی onboarding.

**راهکار:** فقط نسخه فعال حفظ شود؛ نسخه‌های قدیمی با Git history حذف شوند. هر domain به `features/<domain>/{api,model,components,hooks}` شکسته شود؛ command/queryها در service/repository و فرم‌ها با schema validation (مثلاً Zod) جدا شوند. سقف پیشنهادی component حدود ۲۵۰–۴۰۰ خط است، نه قانون مطلق.

#### ۴.۷ نبود تست frontend و تست واحد دامنه

هیچ فایل `*.test.*` یا `*.spec.*` در frontend مشاهده نشد و script موسوم به lint فقط `tsc --noEmit` است.

**راهکار:**

- Vitest برای utilityها، permissionها، mapperها و state transitions؛
- React Testing Library برای auth/tenant/command failure؛
- Playwright برای مسیرهای حیاتی login → tenant → task و admin review → publish؛
- ESLint با rules مربوط به hooks، floating promises، unsafe `any` و accessibility؛
- coverage threshold هدفمند برای domain logic، نه درصد نمایشی کل UI.

#### ۴.۸ backend خالی و وابستگی کامل مرورگر به Supabase

برای CRUD مبتنی بر RLS مناسب است، اما notification provider، فایل، کارهای زمان‌بر، webhook، integration و secret-bearing operation به یک trusted worker/backend نیاز دارند. README نیز تأیید می‌کند outbox فعلاً ارسال واقعی ندارد.

**راهکار:** monolith را حفظ کنید ولی یک worker/server کوچک برای outbox، retry، idempotency، rate limit، provider webhook و observability بسازید؛ service-role فقط در آن محیط و هرگز در frontend باشد.

#### ۴.۹ type safety ناقص در مرز داده

استفاده از `as any` و cast کردن Mock به row واقعی، تفاوت schema را پنهان می‌کند. `database.types.ts` دستی/بزرگ به نظر می‌رسد و drift schema محتمل است.

**راهکار:** typeها در CI از schema تولید و drift check شوند؛ DTO و mapper صریح برای Mock/DB تعریف شود؛ `any` در کد domain ممنوع و JSON schemaها در runtime validate شوند.

### P2 — بلوغ عملیاتی

#### ۴.۱۰ مشاهده‌پذیری و مدیریت خطا

خطاها عمدتاً `console.warn/error` یا toast عمومی هستند؛ tracing، error reporting، metric و audit یکپارچه frontend/backend دیده نمی‌شود.

**راهکار:** error taxonomy، structured logging بدون PII، correlation/request id، Sentry/OpenTelemetry، dashboard برای RPC failure/outbox lag و alert برای migration/cron failure.

#### ۴.۱۱ کارایی و bundle

Mock بزرگ و صفحات بزرگ با import مستقیم احتمالاً bundle اولیه را سنگین می‌کنند؛ route-level lazy loading دیده نشد.

**راهکار:** `React.lazy` برای routeها، split کردن featureها، dynamic import واقعی Mock فقط در dev، budget برای bundle در CI، pagination/server filtering برای کاتالوگ‌ها و بررسی indexها با داده نماینده.

#### ۴.۱۲ مستندات عقب‌تر از کد

Roadmap هنوز بعضی اجزا مانند obligation catalog را «ساخته‌نشده» می‌نامد، در حالی که migration و UI آن موجود است. Supabase README نیز فهرست «تمام migrationها» را فقط با پنج migration آغازین نشان می‌دهد.

**راهکار:** یک ADR برای معماری فعلی، data ownership و مرز Demo؛ تولید خودکار فهرست migration؛ status matrix متصل به issue/PR؛ و runbook برای incident، rollback و بازیابی.

#### ۴.۱۳ دسترس‌پذیری و کیفیت فرم

استفاده از `window.confirm`، componentهای بسیار سفارشی و نبود تست accessibility ریسک keyboard/focus/screen-reader دارد.

**راهکار:** dialog استاندارد قابل دسترس، axe در تست component/E2E، focus management، label/error association و تست keyboard-only برای مسیرهای اصلی.

## ۵. پاسخ صریح: آیا داده آزمایشی وجود دارد؟

**بله، به مقدار زیاد و در چند لایه.** دسته‌بندی کامل یافته‌ها:

### ۵.۱ Mock مرکزی frontend

`frontend/lib/mockDb.ts` هزاران خط fixture درون‌حافظه‌ای دارد، شامل:

- الگوها و مراحل اعتراض، overrideهای انواع مالیات و مراجع حقوقی؛
- تمدید مهلت و obligations؛
- Tenant و عضویت؛
- fulfillment، دوره دفاتر تجاری و checklist؛
- سال مالی، اظهارنامه عملکرد و VAT؛
- خانواده/تعهد/نسخه/rule/condition/workflow/step/circular استودیوی ادمین.

این داده‌ها با reload از بین می‌روند، اما وقتی Supabase تنظیم نشده باشد خودکار فعال‌اند.

### ۵.۲ Mock احراز هویت

`frontend/lib/mockAuth.ts` جلسه ساختگی را در `localStorage` نگه می‌دارد. فعال‌سازی آن opt-in است، ولی session واقعی Supabase نیست و برای محیط deployed نباید فعال شود.

### ۵.۳ داده سخت‌کدشده در componentها

- `CompanyInsurance.tsx`: سوابق ماهانه بیمه، پرسنل، قرارداد، مبلغ، کارفرما و شماره‌های نمونه.
- `AdminCircularCenter.tsx`: پرونده `case-demo-1` و fallback بخشنامه‌ها.
- `CommercialBooksAdminPage.tsx`: CRUD فقط روی mock و مقادیر پیش‌فرض تاریخ/عنوان.
- `AdminSidebar.tsx`: نمایش دائمی ماژول‌های demo.
- Studio V2/V3/V4، صفحات tax/checklist/objection/extension و چند component شرکت به mock repository وابسته‌اند.

Placeholderهای فرم (مثل `admin@example.com`) داده ذخیره‌شده نیستند و به‌تنهایی fixture محسوب نمی‌شوند؛ اما مقادیر state اولیه و آرایه‌های بالا داده نمایشی واقعی‌اند.

### ۵.۴ Seed در migrationهای دیتابیس

1. `20260818173000_seed_corporate_tax_studio_sample.sql`: نمونه Draft مالیات اشخاص حقوقی، rule، step و transition؛ فقط اگر platform admin پیدا کند اجرا می‌شود.
2. `20260826000000_performance_income_tax_workflow.sql`: actorهای مالیاتی را seed می‌کند.
3. `20260826000001_performance_income_tax_seed.sql`: document type، legal reference، تعطیلات نمونه/ناقص، obligation و workflow کامل مالیات عملکرد را با UUID ثابت insert/upsert می‌کند.

این موارد برخلاف fixtureهای تست، rollback نمی‌شوند و با اجرای migration وارد دیتابیس مقصد می‌شوند؛ بنابراین مهم‌ترین یافته ممیزی داده آزمایشی‌اند.

### ۵.۵ Fixtureهای تست SQL

چهار فایل `supabase/tests/*.sql` شرکت/کاربر/تعهد/بخشنامه آزمایشی و UUIDهای رزروشده می‌سازند، اما همگی در transaction هستند و در پایان rollback و عدم باقی‌ماندن fixture را بررسی می‌کنند. این داده‌ها برای تست مناسب‌اند و نباید در production اجرا شوند.

### ۵.۶ داده واقعی حساس یا Secret

در جست‌وجوی فایل‌های version-controlled، secret واقعی، service-role key، JWT، password دیتابیس یا connection string دارای credential مشاهده نشد. `.env` واقعی ignore است و فقط `.env.example` track می‌شود. با این حال secret scanning فعلی pattern-based است؛ افزودن ابزارهایی مثل Gitleaks و محافظت repository توصیه می‌شود.

## ۶. برنامه اصلاح پیشنهادی

### هفته ۱ — Truthfulness و مرز محیط

1. ممنوع کردن fallback Mock در production و افزودن banner demo.
2. حذف success کاذب و refetch بعد از command.
3. خاموش کردن routeهای کاملاً نمایشی در production.
4. جدا کردن seed demo از migration production و توقف انتشار تعطیلات ناقص.
5. نوشتن تست regression برای چهار مورد بالا.

### هفته ۲ تا ۳ — جداسازی لایه‌ها

1. تعریف repository interfaces و composition root.
2. شکستن Studio V4 و حذف V2/V3.
3. permission matrix و guard مبتنی بر permission.
4. تولید خودکار database types و حذف `any` از مسیرهای حساس.

### هفته ۴ تا ۶ — آزمون و عملیات

1. Vitest/RTL/Playwright و axe.
2. worker امن notification + retry/idempotency.
3. observability و runbook.
4. bundle budget، lazy routes و pagination.

## ۷. معیار آمادگی انتشار

- build production بدون fixtureهای Mock؛
- نبود fallback از خطای API به داده ساختگی؛
- هیچ پیام موفقیت بدون تأیید server؛
- تست role × permission و RLS سبز؛
- تست E2E مسیرهای حیاتی سبز؛
- seed حقوقی دارای مالک، منبع، تاریخ اثر و approval؛
- outbox دارای worker، retry، idempotency و monitoring؛
- backup/restore و migration rollback runbook آزمایش‌شده؛
- frontend error monitoring و audit trail قابل پیگیری؛
- مستندات و وضعیت قابلیت‌ها با schema و UI همگام.

## ۸. محدودیت‌های ممیزی

- اعتبار مواد قانونی، مهلت‌ها و متن منابع نیازمند بازبینی متخصص حقوق مالیاتی است.
- تست SQL نیازمند Docker/Supabase محلی یا project مجزا است؛ مرور ایستا جای اجرای آن را نمی‌گیرد.
- امنیت production به تنظیمات بیرون مخزن (Supabase Auth، redirect allow-list، secrets، WAF، backup و policyهای سازمان) نیز وابسته است.
- dependency audit وضعیت شناخته‌شده امروز را می‌سنجد و تضمین امنیت آینده نیست.
