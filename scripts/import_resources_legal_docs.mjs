import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const pw = process.env.SUPABASE_DB_PASSWORD;
if (!pw) {
    console.error('Missing SUPABASE_DB_PASSWORD in .env');
    process.exit(1);
}

const conn = `postgresql://postgres.shiqfawlgeintqsibqmk:${encodeURIComponent(pw)}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`;
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function normalizeCode(code, type) {
    if (!code) return '';
    let c = code.trim();
    c = c.replace(/^(Luật số|Nghị định số|Thông tư số|Nghị quyết số|Quyết định số|Số)\s*[:\.]\s*/i, '$1 ');

    if (type === 'luat') {
        if (c.toLowerCase().includes('nghị quyết')) {
            const match = c.match(/(?:Nghị quyết số|Nghị quyết|Số)\s*([^\s]+)/i);
            return match ? `Nghị quyết số ${match[1]}` : c;
        } else {
            const match = c.match(/(?:Luật số|Luật|Số)\s*([^\s]+)/i);
            return match ? `Luật số ${match[1]}` : `Luật số ${c}`;
        }
    } else if (type === 'nghi-dinh') {
        const match = c.match(/(?:Nghị định số|Nghị định|NĐ|Số)\s*([^\s]+)/i);
        return match ? `Nghị định số ${match[1]}` : `Nghị định số ${c}`;
    } else if (type === 'thong-tu') {
        const match = c.match(/(?:Thông tư số|Thông tư|TT|Số)\s*([^\s]+)/i);
        return match ? `Thông tư số ${match[1]}` : `Thông tư số ${c}`;
    } else if (type === 'quyet-dinh') {
        const match = c.match(/(?:Quyết định số|Quyết định|QĐ|Số)\s*([^\s]+)/i);
        return match ? `Quyết định số ${match[1]}` : `Quyết định số ${c}`;
    } else if (type === 'qcvn') {
        if (!c.toUpperCase().includes('QCVN') && !c.toUpperCase().includes('TCVN')) {
            return `QCVN ${c}`;
        }
        return c;
    }
    return c;
}

function normalizeTitle(title) {
    if (!title) return '';
    let t = title.trim();
    t = t.toLowerCase();
    t = t.charAt(0).toUpperCase() + t.slice(1);
    
    const replacements = [
        { pattern: /\bchính phủ\b/gi, replacement: 'Chính phủ' },
        { pattern: /\bquốc hội\b/gi, replacement: 'Quốc hội' },
        { pattern: /\bviệt nam\b/gi, replacement: 'Việt Nam' },
        { pattern: /\bbộ xây dựng\b/gi, replacement: 'Bộ Xây dựng' },
        { pattern: /\bbộ công an\b/gi, replacement: 'Bộ Công an' },
        { pattern: /\bluật xây dựng\b/gi, replacement: 'Luật Xây dựng' },
        { pattern: /\bluật đầu tư công\b/gi, replacement: 'Luật Đầu tư công' },
        { pattern: /\bluật đầu tư\b/gi, replacement: 'Luật Đầu tư' },
        { pattern: /\bluật quy hoạch\b/gi, replacement: 'Luật Quy hoạch' },
        { pattern: /\bluật đấu thầu\b/gi, replacement: 'Luật Đấu thầu' },
        { pattern: /\bluật hải quan\b/gi, replacement: 'Luật Hải quan' },
        { pattern: /\bluật thuế giá trị gia tăng\b/gi, replacement: 'Luật Thuế giá trị gia tăng' },
        { pattern: /\bluật thuế xuất khẩu\b/gi, replacement: 'Luật Thuế xuất khẩu' },
        { pattern: /\bluật thuế nhập khẩu\b/gi, replacement: 'Luật Thuế nhập khẩu' },
        { pattern: /\bluật quản lý\b/gi, replacement: 'Luật Quản lý' },
        { pattern: /\bsử dụng tài sản công\b/gi, replacement: 'Sử dụng tài sản công' },
        { pattern: /\btrí tuệ nhân tạo\b/gi, replacement: 'Trí tuệ nhân tạo' },
        { pattern: /\bkhoa học và công nghệ\b/gi, replacement: 'Khoa học và Công nghệ' },
        { pattern: /\bchuyển đổi số\b/gi, replacement: 'Chuyển đổi số' },
        { pattern: /\bpccc\b/gi, replacement: 'PCCC' },
        { pattern: /\bcsdl\b/gi, replacement: 'CSDL' },
        { pattern: /\bhđxd\b/gi, replacement: 'HĐXD' }
    ];
    
    for (const item of replacements) {
        t = t.replace(item.pattern, item.replacement);
    }
    return t;
}

function generateShortTitle(code, title, docType) {
    let shortCode = code;
    let match = code.match(/(?:Luật số|Nghị định số|Thông tư số|Nghị quyết số|Quyết định số|Số)\s*([^\s]+)/i);
    if (match) {
        const num = match[1];
        const parts = num.split('/');
        if (parts.length >= 2) {
            const numYear = `${parts[0]}/${parts[1]}`;
            if (docType === 'luat') {
                if (code.toLowerCase().includes('nghị quyết')) {
                    shortCode = `NQ ${numYear}`;
                } else {
                    shortCode = `Luật ${numYear}`;
                }
            } else if (docType === 'nghi-dinh') {
                shortCode = `NĐ ${numYear}`;
            } else if (docType === 'thong-tu') {
                shortCode = `TT ${numYear}`;
            } else if (docType === 'quyet-dinh') {
                shortCode = `QĐ ${numYear}`;
            }
        }
    } else if (docType === 'qcvn' || code.toUpperCase().includes('QCVN') || code.toUpperCase().includes('TCVN')) {
        shortCode = code;
    }

    let keyword = '';
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('phân cấp công trình')) {
        keyword = 'Phân cấp công trình';
    } else if (titleLower.includes('an toàn cháy')) {
        keyword = 'An toàn cháy';
    } else if (titleLower.includes('suất vốn đầu tư')) {
        keyword = 'Suất vốn đầu tư';
    } else if (titleLower.includes('điều kiện năng lực')) {
        keyword = 'Năng lực HĐXD';
    } else if (titleLower.includes('hợp đồng xây dựng')) {
        keyword = 'Hợp đồng XD';
    } else if (titleLower.includes('quyết toán')) {
        keyword = 'Quyết toán vốn';
    } else if (titleLower.includes('phân quyền, phân cấp') || titleLower.includes('phân quyền')) {
        keyword = 'Phân quyền BXD';
    } else if (titleLower.includes('phân định thẩm quyền')) {
        keyword = 'Phân cấp địa phương';
    } else if (titleLower.includes('vật liệu xây dựng')) {
        keyword = 'Vật liệu XD';
    } else if (titleLower.includes('hệ thống thông tin') || titleLower.includes('cơ sở dữ liệu')) {
        keyword = 'CSDL quốc gia về XD';
    } else if (titleLower.includes('trí tuệ nhân tạo')) {
        keyword = 'Trí tuệ nhân tạo';
    } else if (titleLower.includes('chuyển đổi số')) {
        keyword = 'Chuyển đổi số';
    } else if (titleLower.includes('khoa học và công nghệ')) {
        keyword = 'Khoa học & CN';
    } else if (titleLower.includes('quản lý chi phí')) {
        keyword = 'Quản lý chi phí';
    } else if (titleLower.includes('quản lý chất lượng')) {
        keyword = 'Quản lý chất lượng';
    } else if (titleLower.includes('đấu thầu')) {
        keyword = 'Đấu thầu';
    } else if (titleLower.includes('quản lý hoạt động xây dựng')) {
        keyword = 'Quản lý HĐXD';
    } else if (titleLower.includes('quy hoạch')) {
        keyword = 'Quy hoạch';
    } else if (titleLower.includes('đầu tư công')) {
        keyword = 'Đầu tư công';
    } else if (titleLower.includes('đầu tư')) {
        keyword = 'Đầu tư';
    } else if (titleLower.includes('nhà chung cư') || titleLower.includes('chung cư')) {
        keyword = 'Nhà chung cư';
    }

    if (keyword) {
        return `${shortCode} (${keyword})`;
    }
    return shortCode;
}

function parseDocument(content, filename) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    
    let docType = 'quyet-dinh'; // default fallback
    if (filename.toLowerCase().includes('luat') || filename.includes('QH')) docType = 'luat';
    else if (filename.toLowerCase().includes('nghi-dinh') || filename.includes('ND-CP')) docType = 'nghi-dinh';
    else if (filename.toLowerCase().includes('thong-tu') || filename.includes('TT-')) docType = 'thong-tu';
    else if (filename.toLowerCase().includes('qcvn') || filename.toLowerCase().includes('tcvn')) docType = 'qcvn';

    let code = '';
    let issuedDate = '';
    let effectiveDate = '';
    let issuedBy = '';
    let title = '';

    if (docType === 'qcvn') {
        // Try to get QCVN code from first few lines
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const plain = lines[i].replace(/[\*\*\\#]/g, '').trim();
            if (plain.toUpperCase().includes('QCVN') || plain.toUpperCase().includes('TCVN')) {
                code = plain;
                break;
            }
        }
        // Try to get QCVN title
        for (let i = 0; i < Math.min(lines.length, 15); i++) {
            const plain = lines[i].replace(/[\*\*\\#]/g, '').trim();
            if (plain.toUpperCase().startsWith('QUY CHUẨN KỸ THUẬT') || plain.toUpperCase().startsWith('TIÊU CHUẨN QUỐC GIA')) {
                title = plain;
                break;
            }
        }
    }

    for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const line = lines[i];
        if (!code) {
            const codeMatch = line.match(/(?:Luật số|Số|Nghị quyết số|Nghị định số|Quyết định số)\s*[:\.]?\s*([^\s|]+)/i);
            if (codeMatch) {
                let matchedVal = codeMatch[1].replace(/\\/g, '').trim();
                matchedVal = matchedVal.replace(/[.,;:\s]+$/, ''); 
                const matchedFull = codeMatch[0];
                const prefix = matchedFull.substring(0, matchedFull.indexOf(codeMatch[1])).replace(/[:\s]/g, '').trim();
                
                if (prefix.toLowerCase().includes('luật')) {
                    code = 'Luật số ' + matchedVal;
                } else if (prefix.toLowerCase().includes('nghịquyết')) {
                    code = 'Nghị quyết số ' + matchedVal;
                } else if (prefix.toLowerCase().includes('nghịđịnh')) {
                    code = 'Nghị định số ' + matchedVal;
                } else {
                    code = 'Số ' + matchedVal;
                }
            }
        }

        if (!issuedDate) {
            const dateMatch = line.match(/ngày\s+(\d+)\s+tháng\s+(\d+)\s+năm\s+(\d+)/i);
            if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const month = dateMatch[2].padStart(2, '0');
                const year = dateMatch[3];
                issuedDate = `${year}-${month}-${day}`;
            }
        }
    }

    const fullText = content.substring(0, 10000); 
    const effMatch = fullText.match(/(?:hiệu lực thi hành từ ngày|hiệu lực thi hành kể từ ngày|hiệu lực kể từ ngày|hiệu lực thi hành kể từ ngày ký ban hành|có hiệu lực từ ngày|có hiệu lực thi hành từ ngày)\s+(\d+)\s+tháng\s+(\d+)\s+năm\s+(\d+)/i);
    if (effMatch) {
        const day = effMatch[1].padStart(2, '0');
        const month = effMatch[2].padStart(2, '0');
        const year = effMatch[3];
        effectiveDate = `${year}-${month}-${day}`;
    }

    if (!code) {
        const fnMatch = filename.match(/^(\d+)_(\d+)_([A-Z0-9-]+)/);
        if (fnMatch) {
            const num = fnMatch[1];
            const year = fnMatch[2];
            const org = fnMatch[3].replace(/-/g, '/');
            if (org.includes('QH')) {
                code = `Luật số ${num}/${year}/${org}`;
            } else if (org.includes('ND/CP') || org.includes('NĐ/CP')) {
                code = `Nghị định số ${num}/${year}/NĐ-CP`;
            } else {
                code = `Số ${num}/${year}/${org}`;
            }
        } else {
            code = filename.replace(/\.(docx\.md|md|txt)$/i, '').replace(/_/g, ' ');
        }
    }

    if (!title) {
        let titleIndex = -1;
        for (let i = 0; i < Math.min(lines.length, 40); i++) {
            const plain = lines[i].replace(/[\*\#\_]/g, '').trim();
            if (plain === 'LUẬT' || plain === 'NGHỊ ĐỊNH' || plain === 'NGHỊ QUYẾT' || plain === 'THÔNG TƯ' || plain === 'QUYẾT ĐỊNH') {
                titleIndex = i;
                break;
            }
        }
        
        if (titleIndex !== -1 && titleIndex + 1 < lines.length) {
            let parts = [];
            for (let j = titleIndex + 1; j < titleIndex + 4; j++) {
                const nextLine = lines[j].replace(/[\*\#\_]/g, '').replace(/\\/g, '').trim();
                if (
                    nextLine.startsWith('Căn cứ') || 
                    nextLine.startsWith('---') || 
                    nextLine.startsWith('\\-') || 
                    nextLine.includes('của Chính phủ') || 
                    nextLine.includes('Quốc hội ban hành') ||
                    nextLine.startsWith('Số:') ||
                    nextLine.startsWith('Luật số:')
                ) {
                    break;
                }
                if (nextLine) parts.push(nextLine);
            }
            title = parts.join(' ');
        }
    }

    if (!title) {
        title = filename.replace(/\.(docx\.md|md|txt)$/i, '').replace(/_/g, ' ');
    }

    const cleanCode = normalizeCode(code, docType);
    const cleanTitle = normalizeTitle(title);
    const cleanShortTitle = generateShortTitle(cleanCode, cleanTitle, docType);

    if (docType === 'luat') {
        issuedBy = 'Quốc hội';
    } else if (docType === 'nghi-dinh') {
        issuedBy = 'Chính phủ';
    } else if (filename.includes('BXD')) {
        issuedBy = 'Bộ Xây dựng';
    } else if (filename.includes('BCA')) {
        issuedBy = 'Bộ Công an';
    } else {
        issuedBy = 'Chính phủ';
    }

    const doc = {
        id: generateId(),
        code: cleanCode,
        title: cleanTitle,
        short_title: cleanShortTitle,
        type: docType,
        status: 'hieu-luc',
        issued_date: issuedDate || null,
        issued_by: issuedBy,
        effective_date: effectiveDate || issuedDate || null,
        file_name: filename,
        file_path: `/resources/01_phap_ly_quy_chuan/${filename}`,
        file_size: `${Math.round(content.length / 1024)} KB`
    };

    const chapters = [];
    let currentChapter = null;
    let currentArticle = null;
    let currentContent = [];

    const isQcvn = docType === 'qcvn' || 
                   filename.toLowerCase().includes('qcvn') || 
                   filename.toLowerCase().includes('tcvn');

    const appendixRegex = /^(?:#+\s*)?(?:\*\*)*(Phụ lục|PHỤ LỤC)\s*([A-Za-z0-9IVXLCDM\d\.\-\_]*)\s*(.*)/i;

    if (isQcvn) {
        const qcvnChapterRegex = /^([IVXLCDM\d]+)\.\s*(.+)$/;
        const qcvnArticleRegex = /^(?:“|")?(\d+\.\d+(?:\.\d+)*(?:[a-zA-Z])?)(?:\.|:|\s)+(.*)/;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const plainLine = line.replace(/[\*\*\\#]/g, '').trim();

            const apMatch = plainLine.match(appendixRegex);
            if (apMatch && plainLine.length < 250) {
                if (currentArticle) {
                    currentArticle.content = currentContent.join('\n');
                    currentArticle.full_content = currentContent.join('\n');
                }
                
                const apCode = apMatch[2] ? `Phụ lục ${apMatch[2].trim()}` : 'Phụ lục';
                const apTitle = apMatch[3] ? apMatch[3].trim() : '';
                
                currentChapter = {
                    id: generateId(),
                    document_id: doc.id,
                    code: apCode,
                    title: apTitle || apCode,
                    sort_order: chapters.length,
                    articles: []
                };
                chapters.push(currentChapter);
                
                currentArticle = {
                    id: generateId(),
                    chapter_id: currentChapter.id,
                    document_id: doc.id,
                    code: apCode,
                    title: apTitle || 'Nội dung phụ lục',
                    sort_order: 0,
                };
                currentChapter.articles.push(currentArticle);
                currentContent = [];
                continue;
            }

            const chMatch = plainLine.match(qcvnChapterRegex);
            if (chMatch && chMatch[2] === chMatch[2].toUpperCase() && plainLine.length < 200) {
                if (currentArticle) {
                    currentArticle.content = currentContent.join('\n');
                    currentArticle.full_content = currentContent.join('\n');
                }
                
                currentChapter = {
                    id: generateId(),
                    document_id: doc.id,
                    code: `Mục ${chMatch[1]}`,
                    title: chMatch[2].trim(),
                    sort_order: chapters.length,
                    articles: []
                };
                chapters.push(currentChapter);
                currentArticle = null;
                continue;
            }

            const artMatch = plainLine.match(qcvnArticleRegex);
            if (artMatch && plainLine.length < 300) {
                if (currentArticle) {
                    currentArticle.content = currentContent.join('\n');
                    currentArticle.full_content = currentContent.join('\n');
                }

                if (!currentChapter) {
                    currentChapter = {
                        id: generateId(),
                        document_id: doc.id,
                        code: 'Mục 1',
                        title: 'Quy định chung',
                        sort_order: 0,
                        articles: []
                    };
                    chapters.push(currentChapter);
                }

                let title = artMatch[2].trim();
                title = title.replace(/^[“"”'-]\s*/, '').replace(/\s*[”"]$/, '');
                
                if (!title) {
                    // Look ahead for the next non-empty line for a title
                    let nextIdx = i + 1;
                    while (nextIdx < lines.length && !lines[nextIdx].trim()) {
                        nextIdx++;
                    }
                    if (nextIdx < lines.length) {
                        const nextPlain = lines[nextIdx].replace(/[\*\*\\#]/g, '').trim();
                        if (nextPlain.length < 150 && (lines[nextIdx].startsWith('**') || nextPlain.match(/^[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯĂÂÊÔƠƯ]/))) {
                            title = nextPlain;
                            i = nextIdx; // Skip the title line
                        }
                    }
                }

                if (!title) {
                    title = `Mục ${artMatch[1]}`;
                }

                currentArticle = {
                    id: generateId(),
                    chapter_id: currentChapter.id,
                    document_id: doc.id,
                    code: `Mục ${artMatch[1]}`,
                    title: title,
                    sort_order: currentChapter.articles.length,
                };
                currentChapter.articles.push(currentArticle);
                currentContent = [];
                continue;
            }

            if (currentArticle) {
                currentContent.push(line);
            }
        }
    } else {
        const articleRegex = /^(?:#+\s*)?(?:\*\*)*(?:Điều|ĐIỀU)\s+(\d+)(?:\\*\.|:|\.)\s*(.+)/i;
        const chapterRegex = /^(?:#+\s*)?(?:\*\*)*(?:Chương|CHƯƠNG)\s+([IVXLCDM\d]+)(?:\\*\.|:|\.)?\s*(.*)/i;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const plainLine = line.replace(/\*\*/g, '').trim();

            const apMatch = plainLine.match(appendixRegex);
            if (apMatch && plainLine.length < 250) {
                if (currentArticle) {
                    currentArticle.content = currentContent.join('\n');
                    currentArticle.full_content = currentContent.join('\n');
                }
                
                const apCode = apMatch[2] ? `Phụ lục ${apMatch[2].trim()}` : 'Phụ lục';
                const apTitle = apMatch[3] ? apMatch[3].trim() : '';
                
                currentChapter = {
                    id: generateId(),
                    document_id: doc.id,
                    code: apCode,
                    title: apTitle || apCode,
                    sort_order: chapters.length,
                    articles: []
                };
                chapters.push(currentChapter);
                
                currentArticle = {
                    id: generateId(),
                    chapter_id: currentChapter.id,
                    document_id: doc.id,
                    code: apCode,
                    title: apTitle || 'Nội dung phụ lục',
                    sort_order: 0,
                };
                currentChapter.articles.push(currentArticle);
                currentContent = [];
                continue;
            }

            const chMatch = plainLine.match(chapterRegex);
            if (chMatch && plainLine.length < 200) {
                if (currentArticle) {
                    currentArticle.content = currentContent.join('\n');
                    currentArticle.full_content = currentContent.join('\n');
                }
                
                currentChapter = {
                    id: generateId(),
                    document_id: doc.id,
                    code: `Chương ${chMatch[1]}`,
                    title: chMatch[2] || `Chương ${chMatch[1]}`,
                    sort_order: chapters.length,
                    articles: []
                };
                chapters.push(currentChapter);
                currentArticle = null;
                continue;
            }

            const artMatch = plainLine.match(articleRegex);
            if (artMatch && plainLine.length < 200) {
                if (currentArticle) {
                    currentArticle.content = currentContent.join('\n');
                    currentArticle.full_content = currentContent.join('\n');
                }

                if (!currentChapter) {
                    currentChapter = {
                        id: generateId(),
                        document_id: doc.id,
                        code: 'Chương I',
                        title: 'Quy định chung',
                        sort_order: 0,
                        articles: []
                    };
                    chapters.push(currentChapter);
                }

                currentArticle = {
                    id: generateId(),
                    chapter_id: currentChapter.id,
                    document_id: doc.id,
                    code: `Điều ${artMatch[1]}`,
                    title: artMatch[2],
                    sort_order: currentChapter.articles.length,
                };
                currentChapter.articles.push(currentArticle);
                currentContent = [];
                continue;
            }

            if (currentArticle) {
                currentContent.push(line);
            }
        }
    }

    if (currentArticle) {
        currentArticle.content = currentContent.join('\n');
        currentArticle.full_content = currentContent.join('\n');
    }

    return { doc, chapters };
}

async function run() {
    console.log('Connecting to database via pooler...');
    await client.connect();
    console.log('Connected.');

    // 1. Get existing docs to check for duplicate codes
    const existing = await client.query('SELECT id, code FROM public.legal_documents');
    const docMap = new Map(existing.rows.map(r => [r.code, r.id]));

    const dir = join(__dirname, '../resources/01_phap_ly_quy_chuan');
    const files = readdirSync(dir);
    
    let totalImported = 0;

    for (const file of files) {
        if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;

        console.log(`\nParsing: ${file}...`);
        const content = readFileSync(join(dir, file), 'utf-8');
        const parsed = parseDocument(content, file);

        // Overwrite if duplicate code
        if (docMap.has(parsed.doc.code)) {
            const oldId = docMap.get(parsed.doc.code);
            console.log(`   Duplicate found: "${parsed.doc.code}" (Old ID: ${oldId}). Deleting old data...`);
            await client.query('DELETE FROM public.legal_documents WHERE id = $1', [oldId]);
            console.log('   Old data deleted successfully.');
        }

        console.log(`   Inserting document: [${parsed.doc.code}] - "${parsed.doc.short_title || parsed.doc.title.slice(0, 40)}..."`);
        
        // Insert doc
        await client.query(
            `INSERT INTO public.legal_documents 
            (id, code, title, short_title, type, issued_date, effective_date, issued_by, status, summary, file_name, file_path, file_size) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                parsed.doc.id, parsed.doc.code, parsed.doc.title, parsed.doc.short_title, 
                parsed.doc.type, parsed.doc.issued_date, parsed.doc.effective_date, 
                parsed.doc.issued_by, parsed.doc.status, parsed.doc.summary, 
                parsed.doc.file_name, parsed.doc.file_path, parsed.doc.file_size
            ]
        );

        let totalChapters = 0;
        let totalArticles = 0;

        for (const ch of parsed.chapters) {
            // Insert chapter
            await client.query(
                `INSERT INTO public.legal_chapters (id, document_id, code, title, sort_order) 
                VALUES ($1, $2, $3, $4, $5)`,
                [ch.id, ch.document_id, ch.code, ch.title, ch.sort_order]
            );
            totalChapters++;

            for (const art of ch.articles) {
                // Insert article
                await client.query(
                    `INSERT INTO public.legal_articles (id, chapter_id, document_id, code, title, summary, content, full_content, sort_order) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [art.id, art.chapter_id, art.document_id, art.code, art.title, art.summary, art.content, art.full_content, art.sort_order]
                );
                totalArticles++;
            }
        }

        console.log(`   Imported successfully: ${totalChapters} chapters, ${totalArticles} articles.`);
        totalImported++;
    }

    console.log(`\n==================================================`);
    console.log(`🎉 SUCCESS: Imported ${totalImported} legal documents into Supabase!`);
    console.log(`==================================================`);
    await client.end();
}

run().catch(err => {
    console.error('Migration execution failed:', err);
    client.end();
    process.exit(1);
});
