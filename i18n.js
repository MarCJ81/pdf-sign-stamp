/* ============================================================
   OneTap i18n · KO/EN runtime translation (v1)
   - ?lang=en|ko  >  localStorage 'onetap_lang'  >  navigator.language
   - DOM text and attributes are translated in place and restored on switch.
   - Elements added later by app.js are translated by a MutationObserver.
   - Missing keys are reported to console as "I18N_MISS: <korean>".
   ============================================================ */
(function (root, doc) {
  'use strict';

  var LANG_KEY = 'onetap_lang';
  var COMMON = /*__COMMON__*/ {"닫기":"Close","취소":"Cancel","저장":"Save","저장됨":"Saved","삭제":"Delete","복사":"Copy","복사됨":"Copied","다운로드":"Download","내려받기":"Download","공유":"Share","인쇄":"Print","초기화":"Reset","다시 시도":"Try again","불러오기":"Load","내보내기":"Export","적용":"Apply","추가":"Add","편집":"Edit","수정":"Edit","보기":"View","미리보기":"Preview","설정":"Settings","도움말":"Help","사용법":"Guide","예시":"Example","샘플":"Sample","무료":"Free","유료":"Paid","개인정보":"Privacy","개인정보 처리방침":"Privacy policy","개인정보 처리 안내":"Privacy notice","이용약관":"Terms","홈":"Home","뒤로":"Back","다음":"Next","이전":"Previous","확인":"OK","검색":"Search","필터":"Filter","전체":"All","없음":"None","준비 중":"Coming soon","준비 중입니다":"Coming soon","로딩 중":"Loading","불러오는 중":"Loading","처리 중":"Working","빈칸":"Blank","필수":"Required","선택":"Optional","이름":"Name","제목":"Title","날짜":"Date","시간":"Time","메모":"Note","상태":"Status","결과":"Result","요약":"Summary","상세":"Details","언어":"Language","한국어":"Korean","영어":"English","복사하기":"Copy","링크 복사":"Copy link","전체 복사":"Copy all","다크 모드로 전환":"Switch to dark mode","라이트 모드로 전환":"Switch to light mode","테마 전환":"Toggle theme","라이트/다크":"Light / dark","다크/라이트":"Dark / light","새 탭에서 보기":"Open in new tab","새 창":"New window","본문으로 건너뛰기":"Skip to content","본문으로 바로가기":"Skip to content","맨 위로":"Back to top","더 보기":"Show more","접기":"Collapse","펼치기":"Expand","자주 묻는 질문":"Frequently asked questions","이 브라우저에만 저장됩니다":"Saved only in this browser","이 브라우저에만 저장됩니다 · 서버 전송 0":"Saved only in this browser · zero uploads","서버 전송 없음":"No upload","서버 업로드 없음":"No server upload","100% 브라우저 처리":"100% in-browser","브라우저에서 처리":"Processed in your browser","파일은 서버로 전송되지 않습니다":"Files never leave your device","파일이 서버로 전송되지 않습니다":"Files never leave your device","붙여넣은 코드는 서버로 전송되지 않습니다":"Pasted code never leaves your device"};
  var APP = /*__DICT__*/ {"PDF 서명·직인 스튜디오 — 계약서 도장·서명 1분, 서버 전송 0":"PDF Sign & Stamp Studio — sign and seal a contract in a minute, zero uploads","모두싸인·어도비 없이 PDF에 손서명·투명 직인·날짜·체크를 바로 찍고 용역계약서·NDA·거래명세서까지 1분에 만드세요. 파일은 업로드되지 않고 내 PC 브라우저에서만 처리됩니다. 워터마크·건당 과금 0원.":"Sign PDFs with a handwritten signature, a transparent seal, the date or a check — no Modusign or Adobe — and build a service contract, NDA or transaction statement in a minute. Files are never uploaded; everything happens in your browser. No watermark, no per-document fee.","PDF 서명, PDF 도장, 직인 만들기, 전자서명 무료, 계약서 서명, 용역계약서 양식, 거래명세서, NDA 서식, 모두싸인 대체, 어도비 대체":"sign PDF, PDF stamp, seal maker, free e-signature, contract signing, service contract template, transaction statement, NDA template, Modusign alternative, Adobe alternative","PDF 서명·직인 스튜디오":"PDF Sign & Stamp Studio","손서명·투명 직인·날짜·체크를 PDF에 바로. 용역계약서·NDA·거래명세서 양식까지. 업로드 없이 내 브라우저에서만.":"Handwritten signatures, transparent seals, dates and checks straight onto a PDF, plus service contract, NDA and transaction statement templates. No upload — all in your browser.","계약서에 도장 하나 찍자고 월 구독료 내지 마세요. 서버 전송 0, 워터마크 0, 월 0원.":"Don't pay a monthly subscription to put one seal on a contract. Zero uploads, zero watermark, ₩0 a month.","PDF 서명·직인 스튜디오 홈":"PDF Sign & Stamp Studio home","이 페이지가 불러온 외부 도메인 요청 수":"Number of external domain requests this page has made","테마 전환":"Toggle theme","라이트/다크 전환":"Light / dark","도구":"Tools","서명 입력란":"Signature pad","서명 색":"Signature colour","도장 미리보기":"Seal preview","둘레에 새길 상호":"Company name around the rim","도장 색":"Seal colour","예: 2026년 11월 21일":"e.g. 21 November 2026","글자 색":"Text colour","이전 페이지":"Previous page","다음 페이지":"Next page","축소":"Zoomed out","확대":"Zoom","실행 취소":"Undo","실행 취소 (Ctrl+Z)":"Undo (Ctrl+Z)","다시 실행":"Redo","다시 실행 (Ctrl+Y)":"Redo (Ctrl+Y)","속성과 내보내기":"Properties and export","복제":"Duplicate","삭제":"Delete","요소 색":"Element colour","모바일 도구":"Mobile tools","비교표":"Comparison table","서버 전송 0 · 내 PC에서만 처리":"Zero uploads · runs on your own machine","모두싸인·Acrobat 대비 월 0원":"₩0 a month against Modusign or Acrobat","외부 요청 0건":"0 external requests","PDF 다운로드":"Download PDF","서명":"Signature","직인":"Seal","텍스트":"Text","양식":"Templates","파일":"File","손글씨 서명":"Handwritten signature","마우스·펜·손가락으로 그대로 서명하세요.":"Sign with a mouse, a pen or your finger.","여기에 서명":"Sign here","검정":"Black","파랑":"Blue","굵기":"Thickness","되돌리기":"Undo","지우기":"Clear","서명 넣기":"Place signature","서명 저장":"Save signature","이미지 불러오기":"Load image","저장한 서명이 여기에 쌓입니다. 눌러서 바로 꺼내 쓰세요.":"Saved signatures collect here. Press one to use it.","투명 도장 · 직인":"Transparent seal","이름을 넣으면 1초 만에 투명 PNG 도장이 만들어집니다.":"Type a name and a transparent PNG seal appears in a second.","이름 / 도장 글자":"Name / seal text","회사명 (선택)":"Company name (optional)","모양":"Shape","원형":"Round","사각":"Square","글자 배치":"Text direction","세로":"Vertical","가로":"Horizontal","‘인’ 글자 넣기":"Add the character 印","주홍":"Vermilion","청색":"Blue","도장 넣기":"Place seal","보관함에 저장":"Save to library","도장 이미지":"Seal image","저장한 도장이 여기에 쌓입니다.":"Saved seals collect here.","텍스트 · 날짜 · 체크":"Text · date · check","문서를 클릭하면 그 자리에 바로 들어갑니다.":"Click the document and it goes in right there.","오늘 날짜":"Today's date","체크 ✓":"Check ✓","성명":"Name","(인)":"(seal)","넣을 문구":"Text to place","크기":"Size","빨강":"Red","현재 페이지 가운데에 넣기":"Place in the centre of this page","넣은 요소는 드래그로 옮기고, 모서리를 끌어 크기를 바꿉니다. 화살표 키로 1pt씩 미세 조정돼요.":"Drag a placed element to move it, pull a corner to resize, and nudge it 1pt at a time with the arrow keys.","1분 기본 양식":"Ready templates in a minute","폼만 채우면 계약서·명세서 PDF가 바로 만들어집니다.":"Fill the form and the contract or statement PDF is built for you.","닫기":"Close","샘플 값":"Sample values","PDF 만들기":"Build PDF","PDF 불러오기":"Open a PDF","파일은 업로드되지 않습니다. 브라우저 안에서만 열려요.":"Files are never uploaded. They open inside your browser.","PDF 파일 열기":"Open a PDF file","끌어다 놓거나 눌러서 선택":"Drop it here or press to choose","샘플 용역계약서":"Sample service contract","서명란 · 직인란이 있는 2쪽 계약서":"A two-page contract with signature and seal blocks","샘플 거래명세서":"Sample transaction statement","금액 자동 계산 + 영수 문구":"Totals calculated, with a receipt line","샘플 견적서":"Sample quote","품목·부가세 계산 + 유효기간":"Line items, VAT and a validity date","외부 CDN 호출 0건 — 모든 스크립트가 이 폴더 안에 있습니다.":"Zero CDN calls — every script lives in this folder.","원본 PDF의 텍스트·화질은 그대로 두고 서명만 얹습니다.":"The original PDF's text and resolution stay as they are; only your signature is added.","페이지 수·건당 과금·워터마크 제한이 없습니다.":"No page limits, no per-document fee, no watermark.","문서 없음":"No document","PDF를 열거나 양식을 만들어 보세요":"Open a PDF or build one from a template","로컬 처리":"Local","폭 맞춤":"Fit width","서버 전송 0건 · 가입 없음":"Zero uploads · no sign-up","계약서에 도장 하나 찍자고":"Don't pay a monthly subscription","월 구독료 내지 마세요":"just to stamp a contract","손서명 · 투명 직인 · 날짜·체크를 PDF에 바로 찍고, 용역계약서·NDA·거래명세서까지 1분에 완성합니다. 모든 처리는 지금 쓰는 브라우저 메모리에서만 일어나고, 파일은 어디로도 전송되지 않습니다.":"Put a handwritten signature, a transparent seal, the date or a check straight onto a PDF, and finish a service contract, NDA or transaction statement in a minute. Everything happens in this browser's memory and files go nowhere.","끌어다 놓거나 눌러서 선택 · PDF(.pdf)만":"Drop it here or press to choose · PDF only","서명란·직인란 2쪽":"Two pages of signature and seal blocks","금액 자동 계산":"Totals calculated","유효기간 포함":"Validity date included","월 구독료":"Monthly fee","건":"docs","파일 전송":"File upload","종":"files","기본 양식":"Templates","서명 패드":"Signature pad","— 마우스·펜·손가락 그대로, 저장해서 재사용":"— mouse, pen or finger, saved and reused","직인 생성기":"Seal maker","— 이름만 넣으면 투명 PNG 도장 완성":"— a name in, a transparent PNG seal out","— 계약서·NDA·명세서·견적서·영수증 1분 생성":"— contract, NDA, statement, quote and receipt in a minute","PDF를 열면 서명·도장을 바로 찍을 수 있어요.":"Open a PDF and you can sign and stamp it right away.","선택한 요소":"Selected element","문서 위의 서명·도장·텍스트를 누르면 크기·색·투명도를 바꿀 수 있어요.":"Press a signature, seal or text on the page to change its size, colour and opacity.","드래그":"Drag","— 위치 이동":"— move","모서리":"Corner","— 크기 조절 (도장·서명은 비율 유지)":"— resize (seals and signatures keep their ratio)","화살표":"Arrow keys","— 1pt 미세 조정 (Shift는 10pt)":"— nudge 1pt (10pt with Shift)","— 선택 요소 삭제 ·":"— delete the selected element ·","내용":"Content","투명도":"Opacity","회전":"Rotation","내보내기":"Export","파일 이름":"File name","서명·도장이 원본 PDF 위에 그대로 얹혀 저장됩니다.":"Signatures and seals are saved on top of the original PDF.","워터마크 없음":"No watermark","건당 과금 0원":"₩0 per document","원본 화질 유지":"Original resolution kept","내 서명·도장 보관함":"My signature and seal library","저장한 서명·도장은 이 브라우저에만 남습니다.":"Saved signatures and seals stay in this browser only.","속성":"Properties","A4 원본 유지 · 워터마크 0 · 서버 전송 0":"A4 preserved · zero watermark · zero uploads","왜 ‘로컬 서명’이 더 싸고 안전한가":"Why signing locally is cheaper and safer","도장·서명 하나 찍는 일에 매달 구독료를 내고, 민감한 계약서를 남의 서버에 올리던 방식을 그대로 두지 마세요.":"Stop paying a monthly fee to add one seal, and stop putting sensitive contracts on someone else's server.","항목":"Item","모두싸인":"Modusign","어도비 Acrobat Pro":"Adobe Acrobat Pro","월 비용":"Monthly cost","14,900원":"₩14,900","30,300원":"₩30,300","0원":"₩0","건당 제한":"Per-document limit","월 5건":"5 a month","없음":"None","파일 위치":"Where files go","서비스 서버 업로드":"Uploaded to their server","클라우드 동기화":"Cloud sync","내 브라우저 메모리":"Your browser's memory","회원가입":"Sign-up","필요":"Required","요금제별":"Depends on plan","계약서 양식":"Contract templates","템플릿 제공":"Templates included","별도":"Separate","용역계약서·NDA·명세서·영수증":"Contract, NDA, statement, receipt","※ 모두싸인·Acrobat 요금은 2026년 11월 공개된 개인 요금제 기준입니다. 전자계약 발송·추적·감사로그가 필요하면 전용 서비스가 맞습니다. 이 도구는 ‘내 문서에 내가 서명·날인하는 일’을 무료로 끝내는 데 특화되어 있습니다.":"※ Modusign and Acrobat prices are their published individual plans as of November 2026. If you need to send, track and audit electronic contracts, a dedicated service is the right tool. This one is built to finish one job for free: signing and sealing your own documents.","이런 때 쓰세요":"When to use it","프리랜서 용역계약":"Freelance service contract","발주처가 보낸 계약서 PDF를 열고, 서명란에 손서명과 사업자 직인을 찍어 바로 회신합니다.":"Open the contract PDF the client sent, add your signature and business seal, and reply straight away.","NDA 먼저 받기":"Get the NDA signed first","자료를 넘기기 전에 비밀유지서약서를 만들어 서명받고, 상대 서명본에 내 도장까지 한 번에.":"Build an NDA, get it signed before you hand over anything, then seal their signed copy in the same sitting.","거래명세서·영수증":"Transaction statements and receipts","품목·수량·단가만 넣으면 부가세와 한글 금액(일금 … 원정)까지 자동으로 계산됩니다.":"Enter items, quantities and unit prices and the VAT and the written-out amount are calculated for you.","스캔본 마무리":"Finish a scan","종이로 받은 스캔 PDF에 서명·날짜·체크만 얹어 깔끔하게 보관합니다.":"Add a signature, date or check to a scanned paper PDF and keep it tidy.","자주 묻는 질문":"Frequently asked questions","정말 파일이 서버로 안 올라가나요?":"Is it true that files never go to a server?","네. PDF는 브라우저 메모리에서만 열리고, 서명·도장 이미지도 그 자리에서 만들어 PDF 위에 합쳐집니다. 이 페이지가 불러오는 것은 이 폴더의 스크립트와 글꼴뿐이며, 상단 배지의 ‘외부 요청’ 카운터로 직접 확인할 수 있습니다.":"Yes. The PDF opens only in browser memory, and the signature and seal images are made on the spot and merged in. The page loads only scripts and fonts from this folder — you can watch the external-request counter in the badge at the top.","찍은 서명에 법적 효력이 있나요?":"Does a signature placed here have legal effect?","전자서명법상 본인의 서명 또는 기명날인이 있는 전자문서는 문서로서 효력을 가질 수 있습니다. 다만 이 도구는 본인확인·인증서 기반 전자서명이나 공증을 제공하지 않으므로, 상대방 확인이 중요한 계약은 별도의 인증 수단을 함께 쓰세요.":"Under the Electronic Signature Act, an electronic document bearing your own signature or name seal can have effect as a document. This tool does not provide identity verification, certificate-based signatures or notarisation, so for contracts where the other party's confirmation matters, use a separate authentication method as well.","모두싸인처럼 상대방에게 서명을 요청할 수 있나요?":"Can I request a signature from the other party, like Modusign?","발송·추적·감사로그 기능은 없습니다. 대신 완성된 PDF를 메일·메신저로 보내면 됩니다. 서명 요청 워크플로가 필요하면 전자계약 서비스를, 내 문서에 내가 서명하는 일이 대부분이라면 이 도구를 쓰세요.":"There is no sending, tracking or audit log. Send the finished PDF by email or messenger instead. If you need a request-and-track workflow, use an e-contract service; if you mostly sign your own documents, use this.","한자 이름이나 도장도 되나요?":"Do Chinese characters work in names and seals?","기본 글꼴은 한글·영문·숫자·기호를 지원합니다. 한자·이모지는 글꼴에 없어 입력 시 안내가 뜹니다. 한자 도장이 필요하면 도장 이미지를 만들어 ‘도장 이미지’로 넣으면 됩니다.":"The default font covers Korean, Latin letters, digits and symbols. Chinese characters and emoji are not in the font, and you are told when you type them. If you need a seal in Chinese characters, make the seal image and add it through 'Seal image'.","모바일에서도 쓸 수 있나요?":"Does it work on mobile?","네. 아이폰·안드로이드 브라우저에서 손가락으로 서명하고, 그 자리에서 PDF로 저장할 수 있습니다.":"Yes. Sign with your finger in Safari or Chrome on iPhone or Android and save the PDF right there.","법적 효력·공증 한계 고지":"Legal effect and notarisation limits","이 서비스는 PDF에 서명·도장 이미지를 합성하는 문서 편집 도구입니다. 전자서명법상 전자서명의 효력은 서명자의 의사와 서명 방식에 따라 판단되며, 본 도구는 본인확인·인증·시점확인·공증 기능을 제공하지 않습니다. 중요한 계약은 상대방과 서명 방식(날인·자필서명·인증서 전자서명)을 합의하고, 필요하면 공증 또는 인증 서비스를 이용하세요. 제공되는 계약서·명세서 양식은 일반적인 예시로 법률·세무 자문이 아닙니다.":"This is a document editor that merges signature and seal images into a PDF. Under the Electronic Signature Act the effect of an electronic signature depends on the signer's intent and the method used; this tool provides no identity verification, authentication, timestamping or notarisation. For important contracts, agree the signing method with the other party (seal, handwritten signature or certificate-based signature) and use a notary or authentication service where needed. The contract and statement templates are general examples, not legal or tax advice.","PDF 서명·직인 스튜디오 — 브라우저에서만 동작하는 무료 문서 도구":"PDF Sign & Stamp Studio — a free document tool that runs only in your browser","개인정보 처리방침":"Privacy policy","맨 위로":"Back to top","문서":"Document","쪽":"pages","양식으로 생성":"Built from a template","샘플 문서":"Sample document","내 파일":"My file","서명문서":"Signed document","김민수":"Minsu Kim","스크립트를 불러오지 못했습니다:":"Could not load a script:","pdf.js 로드 실패":"pdf.js failed to load","pdf-lib 로드 실패":"pdf-lib failed to load","글꼴을 불러오지 못했습니다":"Could not load the font","_서명":"_signature","암호가 걸린 PDF입니다. 암호를 푼 뒤 다시 열어 주세요.":"This PDF is password-protected. Remove the password, then open it again.","PDF를 열지 못했습니다. 다른 파일로 시도해 주세요.":"Could not open the PDF. Try another file.","되돌릴 작업이 없습니다":"Nothing to undo","다시 실행할 작업이 없습니다":"Nothing to redo","먼저 PDF를 열어 주세요":"Open a PDF first","이 글꼴에 없는 글자(":"Characters missing from this font (",")는 PDF에서 빠집니다":") will be left out of the PDF","요소를 삭제했습니다":"Element deleted","이미지":"Image","서명을 넣었습니다 · 드래그해서 위치를 옮기세요":"Signature placed · drag it into position","도장을 넣었습니다":"Seal placed","브라우저 저장 공간이 부족해 보관함에 저장하지 못했습니다":"Not enough browser storage to save it to the library","도장을 보관함에 저장했습니다":"Seal saved to the library","서명을 보관함에 저장했습니다":"Signature saved to the library","보관한 서명":"Saved signature","문서에 넣기":"Place on document","보관함에서 삭제":"Remove from library","PDF를 만들었습니다 · 서명·도장을 찍어 완성하세요":"PDF built · sign and seal it to finish","양식을 만들지 못했습니다:":"Could not build the template:","오류":"Error","먼저 PDF를 열거나 양식을 만들어 주세요":"Open a PDF or build one from a template first","한글 글꼴을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.":"Could not load the Korean font. Refresh and try again.",")는 제외하고 저장했습니다":") were left out of the saved file",".pdf 저장 완료 ·":".pdf saved ·","PDF를 만들지 못했습니다:":"Could not build the PDF:","알 수 없는 오류":"unknown error","요소를 끌어 옮기고, 모서리로 크기를 조절하세요.":"Drag elements to move them and pull a corner to resize.","원하는 위치를 눌러 서명·도장·텍스트를 넣으세요.":"Press where you want it to place a signature, seal or text.","문서를 클릭하면 그 자리에 텍스트가 들어갑니다.":"Click the document and the text goes in right there.","서명을 그린 뒤 ‘서명 넣기’를 누르면 문서에 들어갑니다.":"Draw a signature, then press 'Place signature'.","이름을 확인하고 ‘도장 넣기’를 누르면 문서에 들어갑니다.":"Check the name, then press 'Place seal'.","양식을 고르고 내용을 채우면 PDF가 바로 만들어집니다.":"Pick a template, fill it in and the PDF is built.","PDF를 끌어다 놓거나 ‘파일 열기’로 바꿀 수 있습니다.":"Drop a PDF here or use 'Open file'.","요소":"Element","먼저 서명을 그려 주세요":"Draw a signature first","저장할 서명을 먼저 그려 주세요":"Draw the signature you want to save first","내 서명":"My signature","서명 이미지를 넣었습니다":"Signature image added","이미지를 읽지 못했습니다":"Could not read the image","도장":"Seal","도장 이미지를 넣었습니다":"Seal image added","성명:":"Name:","PDF 파일(.pdf)만 업로드할 수 있습니다.":"Only PDF files can be opened.","PDF를 열었습니다 · 이 파일은 어디로도 전송되지 않았습니다":"PDF opened · this file was not sent anywhere","샘플_거래명세서":"sample_statement","샘플_견적서":"sample_quote","샘플_용역계약서":"sample_contract","샘플 문서를 열었습니다":"Sample document opened","샘플을 만들지 못했습니다":"Could not build the sample","샘플 값을 채웠습니다":"Sample values filled in","외부 요청":"External requests","파일을 직접 열면 브라우저 보안 때문에 글꼴·PDF 엔진을 읽지 못합니다. GitHub Pages 주소나 로컬 서버(http://)로 열어 주세요.":"Opening the file directly blocks the browser from reading the fonts and PDF engine. Open it from the GitHub Pages address or a local server (http://) instead.","공급가액":"Subtotal","· 부가세":"· VAT","· 합계":"· Total","이미지를 넣었습니다":"Image added","용역계약서":"Service contract","비밀유지서약서 (NDA)":"Non-disclosure agreement (NDA)","거래명세서":"Transaction statement","견적서":"Quote","영수증":"Receipt","자동 계산":"Calculated","가장 많이 쓰는 서식":"The most-used template","자료를 넘기기 전에 받아두는 비밀유지 약정서":"A confidentiality undertaking to collect before you share anything","품목·수량·단가·부가세 자동 계산, 영수문구와 직인란까지":"Items, quantities, prices and VAT calculated, with a receipt line and seal block","품목별 금액·부가세 자동 계산, 유효기간까지 한 장에":"Line totals and VAT calculated, validity date on one page","계좌이체·현금 거래용 간이 영수증":"A simple receipt for bank transfers and cash","프리랜서·1인 사업자 표준 용역계약 — 대금·기간·비밀유지·지재권 조항 포함":"Standard freelance service contract — payment, term, confidentiality and IP clauses","품목·수량·단가·부가세 자동 계산, 영수 문구와 직인란까지":"Items, quantities, prices and VAT calculated, with a receipt line and seal block","원":"KRW","워터마크":"Watermark"};
  var PATTERNS = /*__PATTERNS__*/ [[new RegExp("^(A\\d) · (\\d+)쪽 · 샘플 문서$", ""), "$1 · $2 page · sample document"],[new RegExp("^(A\\d) · (\\d+)쪽 · (.+)$", ""), "$1 · $2 pages · $3"],[new RegExp("^(A\\d) · (\\d+)쪽$", ""), "$1 · $2 pages"],[new RegExp("^(\\d+)쪽$", ""), "$1 pages"]];

  var DICT = {};
  var k;
  for (k in COMMON) if (Object.prototype.hasOwnProperty.call(COMMON, k)) DICT[k] = COMMON[k];
  for (k in APP) if (Object.prototype.hasOwnProperty.call(APP, k)) DICT[k] = APP[k];

  var HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;
  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, SVG: 1 };
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var state = { lang: 'ko' };
  var records = [];
  var missing = {};
  var missingList = [];
  var observer = null;

  /* ---------- language ---------- */
  function detect() {
    try {
      var q = new URLSearchParams(root.location.search).get('lang');
      if (q === 'ko' || q === 'en') return q;
    } catch (e) { /* very old browser */ }
    try {
      var saved = root.localStorage.getItem(LANG_KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch (e) { /* private mode */ }
    var nav = root.navigator.language || root.navigator.userLanguage || 'ko';
    return /^ko/i.test(nav) ? 'ko' : 'en';
  }

  /* ---------- lookup ---------- */
  function report(text) {
    if (missing[text]) return;
    missing[text] = 1;
    missingList.push(text);
    if (root.console && console.warn) console.warn('I18N_MISS: ' + text);
  }

  /* Pattern with capture translation: captures that still hold Korean are looked up too. */
  function applyPattern(core, p) {
    if (!p[0].test(core)) return null;
    var m = p[0].exec(core);
    var caps = [], i, ok = true;
    for (i = 1; i < m.length; i++) {
      var c = m[i];
      if (c == null) { caps[i] = ''; continue; }
      if (HANGUL.test(c)) {
        var t = lookupSmall(c.trim());
        if (t == null) { ok = false; caps[i] = c; } else { caps[i] = t; }
      } else { caps[i] = c; }
    }
    var out = p[1].replace(/\$(\d+)/g, function (all, n) { return caps[+n] != null ? caps[+n] : all; });
    if (!ok || HANGUL.test(out)) return null;
    return out;
  }

  function tr(raw) {
    if (typeof raw !== 'string' || !HANGUL.test(raw)) return raw;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    var lead = m[1], core = m[2], tail = m[3];
    if (!core) return raw;
    var hit = DICT[core];
    if (hit == null && /\s{2,}|\n/.test(core)) hit = DICT[core.replace(/\s+/g, ' ').trim()];
    if (hit != null) return lead + hit + tail;

    /* Korean date: 2026년 11월 27일 -> November 27, 2026 */
    var dt = /^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/.exec(core);
    if (dt) {
      var MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var mm = parseInt(dt[2], 10);
      if (mm >= 1 && mm <= 12) return lead + MO[mm - 1] + ' ' + parseInt(dt[3], 10) + ', ' + dt[1] + tail;
    }

    /* money in Korean format: 81만 원 / 2,980,750원  ->  {0} template */
    var money = takeMoney(core);
    if (money.map.length) {
      var tpl = money.text;
      var th = DICT[tpl];
      if (th == null && /\s{2,}|\n/.test(tpl)) th = DICT[tpl.replace(/\s+/g, ' ').trim()];
      if (th == null && /^\{0\}$/.test(tpl.trim())) th = '{0}';
      if (th != null) return lead + putMoney(th, money.map) + tail;
      for (var mi = 0; mi < PATTERNS.length; mi++) {
        var mo = applyPattern(tpl, PATTERNS[mi]);
        if (mo != null) return lead + putMoney(mo, money.map) + tail;
      }
    }
    for (var i = 0; i < PATTERNS.length; i++) {
      var pout = applyPattern(core, PATTERNS[i]);
      if (pout != null) return lead + pout + tail;
    }
    var seg = trSegments(core);
    if (seg != null) return lead + seg + tail;
    report(core);
    return raw;
  }


  /* Korean money -> token template; values are formatted as ₩1,234,567 */
  function won(n) { return '₩' + n.toLocaleString('en-US'); }
  function takeMoney(core) {
    var map = [];
    var out = core.replace(/([\d,]+)\s*만(?:\s*([\d,]+))?\s*원/g, function (all, a, b) {
      var n = parseInt(a.replace(/,/g, ''), 10) * 10000 + (b ? parseInt(b.replace(/,/g, ''), 10) : 0);
      map.push(won(n));
      return '{' + (map.length - 1) + '}';
    });
    out = out.replace(/([+\-]?[\d,]+)\s*원/g, function (all, a) {
      map.push('₩' + a);
      return '{' + (map.length - 1) + '}';
    });
    return { text: out, map: map };
  }
  function putMoney(s, map) {
    return s.replace(/\{(\d+)\}/g, function (all, i) { return map[+i] != null ? map[+i] : all; });
  }

  /* A small unit: dictionary hit or pattern hit, no whitespace trimming. */
  function lookupSmall(unit) {
    var hit = DICT[unit];
    if (hit != null) return hit;
    for (var i = 0; i < PATTERNS.length; i++) {
      var pout = applyPattern(unit, PATTERNS[i]);
      if (pout != null) return pout;
    }
    return null;
  }

  function trPipe(line) {
    var parts = line.split(/\s*\|\s*/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var t = lookupSmall(parts[i].trim());
      if (t == null) return null;
      out.push(t);
    }
    return out.join(' | ');
  }

  function trSegments(core) {
    if (core.indexOf('\n') > -1) {
      var lines = core.split('\n');
      var out = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.trim()) { out.push(line); continue; }
        var t = line.indexOf('|') > -1 ? trPipe(line) : lookupSmall(line.trim());
        if (t == null) { if (root.__I18N_DEBUG) (root.__I18N_SEGFAIL = root.__I18N_SEGFAIL || []).push(line); return null; }
        out.push(t);
      }
      return out.join('\n');
    }
    if (core.indexOf('|') > -1) return trPipe(core);
    return null;
  }

  /* ---------- DOM walking ---------- */
  function skipped(el) {
    while (el) {
      if (el.nodeType === 1) {
        if (SKIP_TAG[el.tagName]) return true;
        if (el.getAttribute && (el.hasAttribute('data-i18n-skip') || el.getAttribute('contenteditable') === 'true')) return true;
        if (el.classList && el.classList.contains('onetap-lang')) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function trText(node) {
    var v = node.nodeValue;
    if (!v || !HANGUL.test(v)) return;
    var out = tr(v);
    if (out !== v) {
      records.push({ n: node, v: v });
      node.nodeValue = out;
    }
  }

  function trAttrs(el) {
    var i, at, v, out;
    for (i = 0; i < ATTRS.length; i++) {
      at = ATTRS[i];
      if (!el.hasAttribute(at)) continue;
      v = el.getAttribute(at);
      if (!v || !HANGUL.test(v)) continue;
      out = tr(v);
      if (out !== v) {
        records.push({ e: el, a: at, v: v });
        el.setAttribute(at, out);
      }
    }
    if (el.tagName === 'INPUT' && el.hasAttribute('value') && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'hidden') {
      v = el.getAttribute('value');
      if (v && HANGUL.test(v)) {
        out = tr(v);
        if (out !== v) {
          records.push({ e: el, a: 'value', v: v });
          el.setAttribute('value', out);
          if (el.value === v) el.value = out;
        }
      }
    }
    if (el.tagName === 'INPUT') {
      var ty = (el.type || '').toLowerCase();
      if (ty === 'button' || ty === 'submit' || ty === 'reset') {
        v = el.value;
        if (v && HANGUL.test(v)) {
          out = tr(v);
          if (out !== v) { records.push({ e: el, a: 'value', v: v }); el.value = out; }
        }
      }
    }
  }

  function walk(node) {
    if (node.nodeType === 3) { trText(node); return; }
    if (node.nodeType !== 1) return;
    if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'SVG' &&
        !(node.classList && node.classList.contains('onetap-lang'))) trAttrs(node);
    if (skipped(node)) return;
    if (node.tagName === 'META') return;
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function trMeta() {
    var list = doc.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], v = el.getAttribute('content');
      if (v && HANGUL.test(v)) {
        var out = tr(v);
        if (out !== v) { records.push({ e: el, a: 'content', v: v }); el.setAttribute('content', out); }
      }
    }
  }

  function trJsonLd() {
    var list = doc.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      try {
        var data = JSON.parse(el.textContent);
        var changed = fixJson(data);
        if (changed) el.textContent = JSON.stringify(data);
      } catch (e) { /* leave as is */ }
    }
  }

  function fixJson(o) {
    var changed = false, i;
    if (Array.isArray(o)) {
      for (i = 0; i < o.length; i++) if (fixJson(o[i])) changed = true;
      return changed;
    }
    if (!o || typeof o !== 'object') return false;
    for (var key in o) {
      if (!Object.prototype.hasOwnProperty.call(o, key)) continue;
      var v = o[key];
      if (typeof v === 'string' && HANGUL.test(v)) {
        var out = DICT[v.trim()];
        if (out != null) { o[key] = out; changed = true; }
      } else if (v && typeof v === 'object') {
        if (fixJson(v)) changed = true;
      }
    }
    return changed;
  }

  /* ---------- apply / restore ---------- */
  function trFieldValues() {
    var list = doc.querySelectorAll('input, textarea');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var ty = (el.type || 'text').toLowerCase();
      if (ty === 'checkbox' || ty === 'radio' || ty === 'hidden' || ty === 'file' || ty === 'date' || ty === 'number') continue;
      if (el === doc.activeElement) continue;
      var v = el.value;
      if (!v || !HANGUL.test(v)) continue;
      var out = tr(v);
      if (out !== v) { records.push({ e: el, a: 'prop:value', v: v }); el.value = out; }
    }
  }

  function applyEn() {
    var title = root.__onetapTitle || (root.__onetapTitle = doc.title);
    walk(doc.body);
    trFieldValues();
    trMeta();
    trJsonLd();
    doc.documentElement.lang = 'en';
    var t = DICT[title] || DICT[title.trim()];
    doc.title = t || title;
  }

  function restoreKo() {
    for (var i = records.length - 1; i >= 0; i--) {
      var r = records[i];
      if (r.n) { if (r.n.nodeValue !== r.v) r.n.nodeValue = r.v; }
      else if (r.e) {
        if (r.a === 'value' || r.a === 'prop:value') { if (r.e.value !== r.v) r.e.value = r.v; }
        else if (r.e.getAttribute(r.a) !== r.v) r.e.setAttribute(r.a, r.v);
      }
    }
    var title = root.__onetapTitle;
    if (title) doc.title = title;
    doc.documentElement.lang = 'ko';
  }

  /* ---------- language switch UI ---------- */
  function buildSwitch() {
    var wrap = doc.createElement('div');
    wrap.className = 'onetap-lang';
    wrap.setAttribute('role', 'group');
    wrap.innerHTML = '<button type="button" data-onetap-lang="ko" aria-pressed="true">KO</button>' +
      '<button type="button" data-onetap-lang="en" aria-pressed="false">EN</button>';
    var box = doc.querySelector('.top-actions') || doc.querySelector('.topbar__inner') ||
      doc.querySelector('.topbar-inner') || doc.querySelector('.topbar-in') ||
      doc.querySelector('.topbar') || doc.querySelector('header');
    if (box) {
      if (box.classList.contains('top-actions')) box.insertBefore(wrap, box.firstChild);
      else {
        var act = box.querySelector('.top-actions');
        if (act) box.insertBefore(wrap, act); else box.appendChild(wrap);
      }
    } else {
      wrap.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:rgba(255,255,255,.9);color:#111';
      doc.body.appendChild(wrap);
    }
    wrap.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-onetap-lang]');
      if (!b) return;
      setLang(b.getAttribute('data-onetap-lang'));
    });
    return wrap;
  }

  var CSS = '.onetap-lang{display:inline-flex;flex:none;align-items:center;padding:2px;border:1px solid currentColor;border-radius:999px;opacity:.72;transition:opacity .15s;vertical-align:middle;align-self:center}' +
    '.onetap-lang:hover,.onetap-lang:focus-within{opacity:1}' +
    '.onetap-lang button{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.04em;line-height:1;padding:5px 6px;border-radius:999px;cursor:pointer;min-width:26px;text-align:center}' +
    '.onetap-lang button[aria-pressed="true"]{background:rgba(128,128,128,.3)}' +
    '@media (max-width:520px){.onetap-lang button{padding:4px 4px;font-size:10px;min-width:22px}.onetap-lang{margin-left:2px}}';

  function injectCss() {
    var s = doc.createElement('style');
    s.id = 'onetap-lang-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function paintSwitch() {
    var bs = doc.querySelectorAll('[data-onetap-lang]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-onetap-lang') === state.lang ? 'true' : 'false');
    }
    var wrap = doc.querySelector('.onetap-lang');
    if (wrap) wrap.setAttribute('aria-label', state.lang === 'ko' ? '언어' : 'Language');
  }

  /* ---------- observe ---------- */
  function startObserver() {
    if (observer || !root.MutationObserver) return;
    observer = new MutationObserver(function (muts) {
      if (state.lang !== 'en') return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') { trText(m.target); continue; }
        if (m.type === 'attributes') { if (m.target.nodeType === 1 && !skipped(m.target)) trAttrs(m.target); continue; }
        for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] });
  }

  function setLang(lang) {
    state.lang = lang === 'en' ? 'en' : 'ko';
    try { root.localStorage.setItem(LANG_KEY, state.lang); } catch (e) { /* private mode */ }
    if (state.lang === 'en') {
      applyEn();
      startObserver();
    } else {
      if (observer) { observer.disconnect(); observer = null; }
      restoreKo();
    }
    paintSwitch();
    try { doc.dispatchEvent(new CustomEvent('onetap:lang', { detail: { lang: state.lang } })); } catch (e) { /* old */ }
  }

  function boot() {
    injectCss();
    buildSwitch();
    state.lang = detect();
    if (state.lang === 'en') {
      applyEn();
      startObserver();
    } else {
      doc.documentElement.lang = 'ko';
    }
    paintSwitch();
    root.ONETAP_I18N = {
      lang: function () { return state.lang; },
      setLang: setLang,
      t: tr,
      missing: function () { return missingList.slice(); },
      dict: DICT
    };
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
