// 儲存原始資料與目前篩選狀態
let allNursingHomes = [];
let currentType = '全部';
let showAvailableOnly = false;

// 【新增】：分頁狀態與每頁筆數
let currentPage = 1;
const itemsPerPage = 10;

// 開啟彈窗
function openCallModal(event, name, tel) {
    event.preventDefault(); // 阻止預設跳轉
    event.stopPropagation(); // 防止卡片展開/收合
    document.getElementById('modalHomeName').textContent = name;
    document.getElementById('confirmCallBtn').href = `tel:${tel}`;
    document.getElementById('callModal').classList.add('active');
}

// 關閉彈窗
function closeCallModal() {
    document.getElementById('callModal').classList.remove('active');
}

// 【任務一新增】：開啟政府連結彈窗
function openGovLinksModal() {
    document.getElementById('govLinksModal').classList.add('active');
}

// 【任務一新增】：關閉政府連結彈窗
function closeGovLinksModal() {
    document.getElementById('govLinksModal').classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    // 綁定取消按鈕與點擊黑底關閉彈窗
    document.getElementById('cancelCallBtn').addEventListener('click', closeCallModal);
    document.getElementById('callModal').addEventListener('click', (e) => {
        if (e.target.id === 'callModal') closeCallModal();
    });

    // 【升級任務】：綁定政府連結按鈕 (支援手機版第1次提示，第2次開啟)
    const govBtn = document.getElementById('govLinksBtn');
    const govTooltip = document.getElementById('govTooltip');
    const closeGovBtn = document.getElementById('closeGovLinksBtn');
    const govModal = document.getElementById('govLinksModal');

    govBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        
        // 【修改】：嚴格只認螢幕寬度，小於等於 600px 才是手機版
        const isMobile = window.innerWidth <= 600;
        
        if (isMobile) {
            // 手機模式：判斷 tooltip 狀態
            if (!govTooltip.classList.contains('active')) {
                // 第 1 次點擊：展開提示框
                govTooltip.classList.add('active');
            } else {
                // 第 2 次點擊：開啟面板並收合提示框
                openGovLinksModal();
                govTooltip.classList.remove('active');
            }
        } else {
            // 電腦模式：點擊直接開啟面板
            openGovLinksModal();
        }
    });

    // 貼心防呆：點擊網頁其他空白處，自動收起 tooltip
    document.addEventListener('click', () => {
        if (govTooltip.classList.contains('active')) {
            govTooltip.classList.remove('active');
        }
    });

    // 綁定關閉按鈕與點擊黑底關閉彈窗
    closeGovBtn.addEventListener('click', closeGovLinksModal);
    govModal.addEventListener('click', (e) => {
        if (e.target.id === 'govLinksModal') closeGovLinksModal();
    });

    // 【緊急修復】：補回這兩行！呼叫初始化函數，並關閉 DOMContentLoaded 區塊
    initApp();
});

async function initApp() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('網路回應異常');

        allNursingHomes = await response.json();

        // 新增：抓取第一筆資料的更新年月，顯示在標題旁 (項目二)
        if (allNursingHomes.length > 0 && allNursingHomes[0].update) {
            document.getElementById('globalUpdateTime').textContent = `資料更新：${allNursingHomes[0].update}`;
        }

        initCitySelect();
        setupEventListeners();

        document.getElementById('resultsList').innerHTML = '<div class="status-msg">請選擇縣市開始查詢</div>';

    } catch (error) {
        console.error('讀取資料失敗:', error);
        document.getElementById('resultsList').innerHTML = '<div class="status-msg">資料載入失敗，請確認 data.json 是否存在。</div>';
    }
}

function initCitySelect() {
    const citySelect = document.getElementById('citySelect');
    // 從資料庫抓出所有不重複的縣市名單
    const cities = [...new Set(allNursingHomes.map(item => item.city))].filter(city => city !== "");

    // 定義五大區域對照表 (包含您指定的離島地區)
    const regionMap = {
        "北部地區": ["基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "宜蘭縣"],
        "中部地區": ["苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣"],
        "南部地區": ["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"],
        "東部地區": ["花蓮縣", "臺東縣"],
        "離島地區": ["澎湖縣", "金門縣", "連江縣"]
    };

    citySelect.innerHTML = '<option value="">選擇縣市</option>';

    // 依序建立 optgroup 並將對應的縣市塞進去
    for (const [regionName, cityList] of Object.entries(regionMap)) {
        // 先篩選出這個區域中，實際「有出現在 JSON 資料庫裡」的縣市
        const availableCities = cityList.filter(city => cities.includes(city));

        // 如果這個區域有資料，才建立下拉選單群組 (避免出現空的分隔線)
        if (availableCities.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `── ${regionName} ──`; // 設定群組標題 (瀏覽器會自動反灰/加粗且無法被點選)

            availableCities.forEach(city => {
                // 新增：計算該縣市狀態為「營業中」的機構數量 (項目一)
                const count = allNursingHomes.filter(item => item.city === city && item.status === "營業中").length;

                const option = document.createElement('option');
                option.value = city;
                option.textContent = `${city} (${count}家)`; // 動態注入數量
                optgroup.appendChild(option);
            });

            citySelect.appendChild(optgroup);
        }
    }
}

function updateDistrictSelect(selectedCity) {
    const districtSelect = document.getElementById('districtSelect');
    districtSelect.innerHTML = '<option value="">全區 (不限行政區)</option>';

    if (!selectedCity) {
        districtSelect.disabled = true;
        return;
    }

    const cityData = allNursingHomes.filter(item => item.city === selectedCity);
    const districts = [...new Set(cityData.map(item => item.district))].filter(dist => dist !== "未知區");

    districts.forEach(district => {
        // 新增：計算該行政區狀態為「營業中」的機構數量 (項目一)
        const count = cityData.filter(item => item.district === district && item.status === "營業中").length;

        const option = document.createElement('option');
        option.value = district;
        option.textContent = `${district} (${count}家)`; // 動態注入數量
        districtSelect.appendChild(option);
    });

    districtSelect.disabled = false;
}

function setupEventListeners() {
    const citySelect = document.getElementById('citySelect');
    const districtSelect = document.getElementById('districtSelect');
    const resultsList = document.getElementById('resultsList');

    citySelect.addEventListener('change', (e) => {
        const selectedCity = e.target.value;
        updateDistrictSelect(selectedCity);

        if (selectedCity) {
            currentPage = 1; // 【新增】這行
            renderCards(selectedCity, "");
        } else {
            resultsList.innerHTML = '<div class="status-msg">請選擇縣市開始查詢</div>';
        }
    });

    districtSelect.addEventListener('change', (e) => {
        const selectedCity = citySelect.value;
        const selectedDistrict = e.target.value;
        if (selectedCity) {
            currentPage = 1; // 【新增】這行
            renderCards(selectedCity, selectedDistrict);
        }
    });

    const filterBtns = document.querySelectorAll('.type-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active'); // 改成 e.currentTarget
            currentType = e.currentTarget.getAttribute('data-type'); // 改成 e.currentTarget

            const city = citySelect.value;
            if (city) 
                currentPage = 1; // 【新增】這行
                renderCards(city, districtSelect.value);
        });
    });

    const availableBtn = document.getElementById('availableOnlyBtn');
    if (availableBtn) {
        availableBtn.addEventListener('click', (e) => {
            showAvailableOnly = !showAvailableOnly;
            e.currentTarget.classList.toggle('active', showAvailableOnly);

            const city = citySelect.value;
            if (city) 
                currentPage = 1; // 【新增】這行
                renderCards(city, districtSelect.value);
        });
    }

    resultsList.addEventListener('click', (e) => {
        const card = e.target.closest('.home-card');
        // 避免點擊按鈕或超連結時觸發卡片收折
        if (card && !e.target.closest('.action-btn') && !e.target.closest('.tax-link')) {
            card.classList.toggle('is-expanded');
        }
    });
}

function renderCards(city, district) {
    const resultsList = document.getElementById('resultsList');

    const filteredData = allNursingHomes.filter(item => {
        const matchCity = item.city === city;
        const matchDistrict = (district === "") ? true : (item.district === district);
        const matchStatus = item.status === "營業中";
        const matchType = (currentType === '全部') || (item.types && item.types.includes(currentType));
        const matchAvailable = showAvailableOnly ? (item.available_beds > 0) : true;

        return matchCity && matchDistrict && matchStatus && matchType && matchAvailable;
    });

    // =========================================
    // 新增優化：項目三、公立機構優先權排序
    // =========================================
    filteredData.sort((a, b) => {
        // 判斷該機構的 ownership 欄位是否包含「公」字
        const aIsGov = (a.ownership && a.ownership.includes('公')) ? 1 : 0;
        const bIsGov = (b.ownership && b.ownership.includes('公')) ? 1 : 0;

        // 讓數值大的 (1，代表公立) 排在前面
        return bIsGov - aIsGov;
    });

    // =========================================
    // 【新增】：計算分頁範圍並裁切資料
    // =========================================
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // 防呆：確保當前頁數不會超出範圍
    if (currentPage > totalPages) currentPage = totalPages || 1;

    // 只抓取該頁的 10 筆資料
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

    if (totalItems === 0) {
        resultsList.innerHTML = '<div class="status-msg">目前無符合條件的機構資料</div>';
        document.getElementById('paginationContainer').innerHTML = ''; // 清空分頁
        return;
    }

    resultsList.innerHTML = ''; 

    // 【修改】：把原本的 filteredData.forEach 改成 paginatedData.forEach
    paginatedData.forEach(item => {

        const card = document.createElement('div');
        card.className = 'home-card';

        const ratingHtml = item.rating ? `<div class="rating-tag">評鑑：<span>${item.rating}</span></div>` : '';

        // 1. 公私立徽章判斷邏輯
        let badgeHtml = '';
        if (item.ownership) {
            if (item.ownership.includes('公')) {
                badgeHtml = `<span class="ownership-badge badge-gov">公</span>`;
            } else if (item.ownership.includes('私')) {
                badgeHtml = `<span class="ownership-badge badge-private">私</span>`;
            }
        }

        // 2. Pro 終極產業鎖定防噪與防改名版：動態過濾無效欄位，智慧破解改名金蟬脫殼
        const searchTerms = [];

        // 防呆 1：基本機構名稱
        if (item.name) searchTerms.push(`"${item.name}"`);

        // 防呆 2：智慧掃描備註，相容引號與各種改名寫法（如：原為...、原名...、原"..."改名）
        if (item.note) {
            let oldName = '';

            // 模式 A：抓取雙引號內的所有文字，例如：原"少同老人..."改名
            const matchQuote = item.note.match(/原"([^"]+)"/);
            if (matchQuote && matchQuote[1]) {
                oldName = matchQuote[1];
            } else {
                // 模式 B：抓取關鍵字後方直到標點符號前的文字，例如：原為海森老人... 或 原名海森老人...
                const matchText = item.note.match(/(?:原為|原名)([^，,。\s]+)/);
                if (matchText && matchText[1]) {
                    oldName = matchText[1];
                }
            }

            // 如果成功逼出舊名稱，拔除殘留引號後塞進搜尋池，讓新舊名字並肩作戰！
            if (oldName) {
                const cleanOldName = oldName.replace(/["']/g, '');
                if (cleanOldName) searchTerms.push(`"${cleanOldName}"`);
            }
        }

        // 防呆 3：負責人、電話、地址
        if (item.manager && item.manager !== '未知') searchTerms.push(`"${item.manager}"`);
        if (item.tel) searchTerms.push(`"${item.tel.split('、')[0]}"`); // 遇到多支電話時，只取第一支
        if (item.address && item.address !== '無地址資料') searchTerms.push(`"${item.address}"`);

        // 將有效機構特徵用 OR 串接
        const queryPrefix = searchTerms.join(' OR ');

        // 擴充黑歷史地雷關鍵字（司法級防禦：新增法院、起訴，並涵蓋各式公文標題）
        const dangerKeywords = "違規 OR 裁罰 OR 處分 OR 勞動糾紛 OR 糾紛 OR 洗錢 OR 不當 OR 虐待 OR 疏忽 OR 超收 OR 非法外勞 OR 非法 OR 違反 OR 老福法 OR 不合格 OR 法院 OR 起訴";

        // 核心防護牆：強制網頁必須包含長照相關字眼，杜絕同名負責人的餐廳評價等無關雜訊
        const industryAnchor = "長照 OR 養護 OR 安養 OR 老人福利 OR 老人機構";

        // 最終組合：(機構特徵) AND (地雷關鍵字) AND (產業防護牆)
        const searchQuery = `(${queryPrefix}) (${dangerKeywords}) (${industryAnchor})`;

        const searchKw = encodeURIComponent(searchQuery);
        const violationBtn = `<a href="https://www.google.com/search?q=${searchKw}" class="mini-alert-btn" target="_blank"><i class="fa-solid fa-magnifying-glass"></i> 查詢</a>`;

        // 3. 標準化 Google Map 導航網址
        const mapSearch = encodeURIComponent(item.city + item.district + item.address);
        const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${mapSearch}`;

        // 4. 備註警示邏輯 (如果有備註，啟動卡片變色與紅字提示)
        let noteHtml = '';
        if (item.note && item.note.trim() !== '') {
            card.classList.add('warning-card');
            noteHtml = `<div class="note-alert"><i class="fa-solid fa-triangle-exclamation" style="margin-top:3px;"></i> <span>備註：${item.note}</span></div>`;
        }
        // 5. 服務標籤邏輯 (如果有安養、養護等，生成綠色小膠囊)
        let tagsHtml = '';
        if (item.types && item.types.length > 0) {
            const tagSpans = item.types.map(t => `<span class="tag">${t}</span>`).join('');
            tagsHtml = `<div class="service-tags">${tagSpans}</div>`;
        }

        // 確保電話撥打功能只抓取第一支電話 (防止「、」導致無法撥號)
        const firstTel = item.tel ? item.tel.split('、')[0] : '';

        // 加入一個 6px 高度的隱藏區塊來撐開微小間距
        const displayTel = item.tel ? item.tel.replace(/、/g, '<br><span style="display:block; height:6px;"></span>') : '';

        card.innerHTML = `
            <div class="card-summary">
                <div class="info-primary">
                    <h2 class="home-name">${badgeHtml}${item.name}${tagsHtml}</h2>
                    ${ratingHtml}
                </div>
                ${noteHtml} 
                <div class="bed-status" style="margin-top: 12px;">
                    <span class="label">可入住：</span>
                    <span class="count highlight">${item.available_beds}</span> 
                    <span class="total">/ ${item.total_beds} 床</span>
                </div>
                <div class="expand-hint"><i class="fa-solid fa-chevron-down"></i> 點擊看詳細資訊</div>
            </div>
            
            <div class="card-details">
                <div class="detail-item flex-between">
                    <div class="manager-box">
                        <i class="fa-solid fa-user-tie"></i> 負責人：<span class="manager">${item.manager}</span> | 
                        立案日期：<span class="establish">${item.establish_date || '未知'}</span>
                    </div>
                    <div class="tax-box">
                        ${violationBtn}
                    </div>
                </div>
                
                <div class="action-grid">
    <!-- onclick 依然傳入 firstTel 確保撥打正確，顯示的電話改為 displayTel 實現換行 -->
    <a href="#" class="action-btn tel-link" onclick="openCallModal(event, '${item.name}', '${firstTel}')">
        <span class="btn-label"><i class="fa-solid fa-phone"></i> 電話：</span><span class="tel">${displayTel}</span>
    </a>
    <a href="${googleMapUrl}" class="action-btn map-link" target="_blank">
        <span class="btn-label"><i class="fa-solid fa-location-dot"></i> 地圖：</span><span class="address">${item.address}</span>
    </a>
</div>
                <div class="update-time" style="margin-top:16px;">資料更新：${item.update}</div>
            </div>
        `;
        resultsList.appendChild(card);
    });

    // 【新增】：呼叫分頁按鈕生成函數
    renderPagination(totalPages);
}

// =========================================
// 新增：渲染分頁按鈕函數
// =========================================
function renderPagination(totalPages) {
    const container = document.getElementById('paginationContainer');

    // 如果只有一頁或沒有資料，就不顯示分頁區塊
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const isFirstPage = currentPage === 1;
    const isLastPage = currentPage === totalPages;

    container.innerHTML = `
        <button id="prevPageBtn" class="page-btn" ${isFirstPage ? 'disabled' : ''}>上一頁</button>
        <span class="page-info">第 ${currentPage} / ${totalPages} 頁</span>
        <button id="nextPageBtn" class="page-btn" ${isLastPage ? 'disabled' : ''}>下一頁</button>
    `;

    // 綁定「上一頁」點擊事件
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                const city = document.getElementById('citySelect').value;
                const district = document.getElementById('districtSelect').value;
                renderCards(city, district);
                // 自動往上捲動到卡片最上方，提升閱讀體驗
                document.getElementById('resultsList').scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // 綁定「下一頁」點擊事件
        const nextBtn = document.getElementById('nextPageBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    const city = document.getElementById('citySelect').value;
                    const district = document.getElementById('districtSelect').value;
                    renderCards(city, district);
                    // 自動往上捲動到卡片最上方
                    document.getElementById('resultsList').scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }
