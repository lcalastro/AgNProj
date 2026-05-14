const express = require('express');
require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@libsql/client');

const upload = multer({ dest: 'uploads/' });
const app = express();

const SECRET = '123456';

// Aumenta limite do body para JSON/Dados grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ==========================================================================
// 1. CONEXÃO COM SQLITE EM ARQUIVO FÍSICO
// ==========================================================================

const dbFile = process.env.SQLITE_DB_FILE || path.join(__dirname, 'data', 'agn.sqlite');
const dbDir = path.dirname(dbFile);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`>>> Usando banco SQLite local: ${dbFile}`);

const db = createClient({
  url: `file:${dbFile}`
});

// ==========================================================================
// 2. FUNÇÃO DE EXECUÇÃO
// ==========================================================================

async function exec(sql, args = []) {
  return db.execute({ sql, args });
}

// ==========================================================================
// 3. ESTRUTURA DO BANCO (DDL)
// ==========================================================================

async function initDB() {
  await exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      coordenacao TEXT,
      role TEXT DEFAULT 'USER',
      criadoem DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      acao TEXT NOT NULL,
      detalhes TEXT,
      ip TEXT,
      criadoem DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      ano INTEGER NOT NULL,
      numero INTEGER NOT NULL,
      usuario_id INTEGER,
      dataregistro TEXT,
      driveid INTEGER,
      processo TEXT,
      objeto TEXT,
      divulgacaocotacao TEXT,
      publicadosite TEXT,
      contratado TEXT,
      coordenacao TEXT,
      orcamento TEXT,
      observacoes TEXT,
      criadoem DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS sequencias (
      tipo TEXT,
      ano INTEGER,
      ultimonumero INTEGER,
      PRIMARY KEY (tipo, ano)
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cnpj TEXT UNIQUE NOT NULL,
      razao_social TEXT NOT NULL,
      contato TEXT,
      cidade TEXT,
      uf TEXT,
      endereco TEXT,
      email TEXT,
      atividades TEXT,
      criadoem DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS segmentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL
    );
  `);
  
  await exec(`
    CREATE TABLE IF NOT EXISTS fornecedor_telefones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fornecedor_id INTEGER NOT NULL,
      numero TEXT NOT NULL,
      whatsapp INTEGER DEFAULT 0,
      FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
    );
  `);
  
  await exec(`
    CREATE TABLE IF NOT EXISTS fornecedor_segmentos (
      fornecedor_id INTEGER NOT NULL,
      segmento_id INTEGER NOT NULL,
      PRIMARY KEY (fornecedor_id, segmento_id),
      FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id),
      FOREIGN KEY (segmento_id) REFERENCES segmentos(id)
    );
  `);
  
  console.log(">>> Estrutura do banco verificada/criada.");
}

// ==========================================================================
// 4. SEED
// ==========================================================================

async function seedAdmin() {
  const emailAdmin = 'aluno@teste.com.br';

  const r = await exec('SELECT id FROM usuarios WHERE email = ?', [emailAdmin]);
  if (r.rows.length === 0) {
    const hash = bcrypt.hashSync(SECRET, 10);
    await exec(`
      INSERT INTO usuarios (nome, email, senha, coordenacao, role)
      VALUES (?, ?, ?, ?, ?)
    `, ['Luis Calastro (Admin)', emailAdmin, hash, 'ADM', 'ADMIN']);

    console.log('>>> Admin Padrão Criado:', emailAdmin);
  } else {
    await exec("UPDATE usuarios SET role = 'ADMIN' WHERE email = ?", [emailAdmin]);
  }
}

async function seedSequencias2026() {
  const check = await exec('SELECT COUNT(*) as c FROM sequencias WHERE ano = 2026', []);
  const c = check.rows[0]?.c || 0;

  if (c === 0) {
    const sequenciasIniciais = [
      { tipo: 'Cotação de Preços', num: 0 },
      { tipo: 'Ordem de Fornecimento', num: 0 },
      { tipo: 'Contratos', num: 0 },
      { tipo: 'Pregão Eletrônico', num: 0 },
      { tipo: 'Ata SRP', num: 0 },
      { tipo: 'Marketplace', num: 0 },
      { tipo: 'Proposta de Aceite', num: 0 },
      { tipo: 'Credenciamento', num: 0 },
      { tipo: 'Convênio', num: 0 },
      { tipo: 'Inexigibilidade', num: 0 },
      { tipo: 'Contrato por Adesão', num: 0 },
      { tipo: 'Acordo de Cooperação', num: 0 }
    ];

    for (const s of sequenciasIniciais) {
      await exec(
        'INSERT INTO sequencias (tipo, ano, ultimonumero) VALUES (?, ?, ?)',
        [s.tipo, 2026, s.num]
      );
    }

    console.log('>>> Sequências 2026 inicializadas com sucesso.');
  }
}

// ==========================================================================
// 5. MIDDLEWARES & HELPERS
// ==========================================================================

const verificarToken = (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ erro: 'Token requerido' });

  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido' });
  }
};

const apenasAdmin = async (req, res, next) => {
  try {
    const r = await exec('SELECT role FROM usuarios WHERE id = ?', [req.usuario.id]);
    const user = r.rows[0];
    if (user && user.role === 'ADMIN') next();
    else res.status(403).json({ erro: 'Acesso negado. Requer perfil Administrador.' });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao verificar permissão.' });
  }
};

const registrarLog = async (usuarioId, acao, detalhes = '') => {
  try {
    await exec(
      'INSERT INTO logs (usuario_id, acao, detalhes, ip) VALUES (?, ?, ?, ?)',
      [usuarioId, acao, detalhes, '127.0.0.1']
    );
  } catch (e) {
    console.error('Erro log:', e.message);
  }
};

const sqlEscape = (val) => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/'/g, "''")}'`;
};

// ==========================================================================
// 6. KEEP ALIVE (leve, a cada 3 minutos)
// ==========================================================================

setInterval(async () => {
  try {
    await exec('SELECT 1;', []);
    // console.log('keepalive ok');
  } catch (e) {
    console.warn('⚠️ keepalive falhou:', e.message);
  }
}, 180000); // 3 minutos

// ==========================================================================
// 7. ROTAS KEEPALIVE / HEALTH, DE BACKUP & RESTORE
// ==========================================================================

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/backup', verificarToken, apenasAdmin, async (req, res) => {
  try {
    let sqlDump = `-- Backup AgN: ${new Date().toISOString()}\n\nBEGIN TRANSACTION;\n\n`;

    sqlDump += `
    DELETE FROM fornecedor_segmentos;
    DELETE FROM fornecedor_telefones;
    DELETE FROM fornecedores;
    DELETE FROM segmentos;
    DELETE FROM documentos;
    DELETE FROM sequencias;
    DELETE FROM logs;
    DELETE FROM usuarios;
    \n`;

    const dumpTable = async (table, cols) => {
      const r = await exec(`SELECT * FROM ${table}`);
      let dump = '';
      for (const row of r.rows) {
        const values = cols.map(c => sqlEscape(row[c])).join(', ');
        dump += `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values});\n`;
      }
      return dump;
    };

    sqlDump += await dumpTable('usuarios', ['id','nome','email','senha','coordenacao','role','criadoem','reset_token','reset_expira']);
    sqlDump += await dumpTable('sequencias', ['tipo','ano','ultimonumero']);
    sqlDump += await dumpTable('documentos', ['id','tipo','ano','numero','usuario_id','dataregistro','driveid','processo','objeto','divulgacaocotacao','publicadosite','contratado','coordenacao','orcamento','observacoes','criadoem']);
    sqlDump += await dumpTable('logs', ['id','usuario_id','acao','detalhes','ip','criadoem']);
    sqlDump += await dumpTable('segmentos', ['id', 'nome']);
    sqlDump += await dumpTable('fornecedores', ['id','cnpj','razao_social','contato','cidade','uf','endereco','email','atividades','criadoem']);
    sqlDump += await dumpTable('fornecedor_telefones', ['id','fornecedor_id','numero','whatsapp']);  
    sqlDump += await dumpTable('fornecedor_segmentos', ['fornecedor_id','segmento_id']);

    sqlDump += `\nCOMMIT;\n`;

    await registrarLog(req.usuario.id, 'BACKUP_EXPORT', 'Download de backup SQL.');

    const filename = `agn_backup_${new Date().toISOString().split('T')[0]}.sql`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'text/plain');
    res.send(sqlDump);

  } catch (e) {
    console.error('Erro backup:', e);
    res.status(500).json({ erro: 'Erro ao gerar backup' });
  }
});

app.post('/api/restore', verificarToken, apenasAdmin, upload.single('backup'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Arquivo não enviado.' });

  try {
    const sql = fs.readFileSync(req.file.path, 'utf-8');

    // EXECUTA SCRIPT SQL COMPLETO (MÚLTIPLOS STATEMENTS)
    await db.executeMultiple(sql);

    fs.unlinkSync(req.file.path);

    await registrarLog(req.usuario.id, 'BACKUP_RESTORE', 'Restore via SQL.');

    res.json({ sucesso: true, mensagem: 'Backup restaurado com sucesso.' });

  } catch (e) {
    console.error('Erro restore:', e);
    res.status(500).json({ erro: 'Erro ao restaurar backup: ' + e.message });
  }
});

// ==========================================================================
// 8. ROTAS DO GERADOR
// ==========================================================================

app.get('/api/sequencias', verificarToken, async (req, res) => {
  try {
    const anoAtual = new Date().getFullYear();
    const r = await exec('SELECT tipo, ultimonumero FROM sequencias WHERE ano = ?', [anoAtual]);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/gerar', verificarToken, async (req, res) => {
  const dados = req.body;
  const anoAtual = new Date().getFullYear();

  if (!dados.tipo || !dados.processo || !dados.objeto) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando.' });
  }

  try {
    const rSeq = await exec(
      'SELECT ultimonumero FROM sequencias WHERE tipo = ? AND ano = ?',
      [dados.tipo, anoAtual]
    );

    const ult = rSeq.rows[0]?.ultimonumero || 0;
    const novoNumero = ult + 1;

    if (rSeq.rows.length > 0) {
      await exec(
        'UPDATE sequencias SET ultimonumero = ? WHERE tipo = ? AND ano = ?',
        [novoNumero, dados.tipo, anoAtual]
      );
    } else {
      await exec(
        'INSERT INTO sequencias (tipo, ano, ultimonumero) VALUES (?, ?, ?)',
        [dados.tipo, anoAtual, novoNumero]
      );
    }

    const dataRegistro = dados.data || new Date().toISOString().split('T')[0];

    const doc = await exec(`
      INSERT INTO documentos (
        tipo, ano, numero, usuario_id, dataregistro, driveid, processo, objeto,
        divulgacaocotacao, publicadosite, contratado, coordenacao, orcamento, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dados.tipo, anoAtual, novoNumero, req.usuario.id,
      dataRegistro,
      dados.drive || null,
      dados.processo,
      dados.objeto,
      dados.divulgacaocotacao || null,
      dados.publicadosite || 'Não',
      dados.contratado || null,
      dados.coordenacao || null,
      dados.orcamento || null,
      dados.observacoes || null
    ]);
    await registrarLog(req.usuario.id, 'GERAR_NUMERADOR', `Criou ${dados.tipo} #${novoNumero}/${anoAtual}`);

    res.json({
      sucesso: true,
      dados: {
        id: doc.lastInsertRowid.toString(),
        numero: novoNumero,
        ano: anoAtual,
        tipo: dados.tipo
      }
    });

  } catch (erro) {
    console.error("Erro ao gerar:", erro);
    res.status(500).json({ erro: 'Erro ao gerar número. Tente novamente.' });
  }
});

// ==========================================================================
// FORNECEDORES
// ==========================================================================

// CADASTRO DE FORNECEDOR (POST)
app.post('/api/fornecedores', verificarToken, async (req, res) => {
  try {
    const {
      cnpj,
      razao_social,
      contato,
      cidade,
      uf,
      endereco,
      email,
      atividades
    } = req.body;

    const telefones = Array.isArray(req.body.telefones) ? req.body.telefones : [];
    const segmentos = Array.isArray(req.body.segmentos) ? req.body.segmentos : [];

    if (!cnpj || !razao_social) {
      return res.status(400).json({ erro: 'CNPJ e Razão Social são obrigatórios.' });
    }

    const r = await exec(`
      INSERT INTO fornecedores
      (cnpj, razao_social, contato, cidade, uf, endereco, email, atividades)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cnpj,
      razao_social,
      contato || null,
      cidade || null,
      uf || null,
      endereco || null,
      email || null,
      atividades || null
    ]);

    const fornecedorId = r.lastInsertRowid;

    // Telefones
    for (const t of telefones) {
      if (!t.numero) continue;
      await exec(
        `INSERT INTO fornecedor_telefones (fornecedor_id, numero, whatsapp)
         VALUES (?, ?, ?)`,
        [fornecedorId, t.numero, t.whatsapp ? 1 : 0]
      );
    }

    // Segmentos
    for (const segId of segmentos) {
      await exec(
        `INSERT INTO fornecedor_segmentos (fornecedor_id, segmento_id)
         VALUES (?, ?)`,
        [fornecedorId, Number(segId)]
      );
    }

    await registrarLog(req.usuario.id, 'FORNECEDOR_CADASTRO', `CNPJ ${cnpj}`);
    res.json({ sucesso: true });

  } catch (e) {
    console.error('ERRO AO CADASTRAR FORNECEDOR:', e);
    res.status(500).json({ erro: e.message });
  }
});

// ATUALIZAR FORNECEDOR
app.put('/api/fornecedores/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const {
      cnpj,
      razao_social,
      contato,
      cidade,
      uf,
      endereco,
      email,
      atividades
    } = req.body;

    const telefones = Array.isArray(req.body.telefones) ? req.body.telefones : [];
    const segmentos = Array.isArray(req.body.segmentos) ? req.body.segmentos : [];

    if (!cnpj || !razao_social) {
      return res.status(400).json({ erro: 'CNPJ e Razão Social são obrigatórios.' });
    }

    // Atualiza fornecedor
    await exec(`
      UPDATE fornecedores
      SET cnpj = ?, razao_social = ?, contato = ?, cidade = ?, uf = ?, endereco = ?, email = ?, atividades = ?
      WHERE id = ?
    `, [
      cnpj,
      razao_social,
      contato || null,
      cidade || null,
      uf || null,
      endereco || null,
      email || null,
      atividades || null,
      id
    ]);

    // Limpa vínculos antigos
    await exec('DELETE FROM fornecedor_telefones WHERE fornecedor_id = ?', [id]);
    await exec('DELETE FROM fornecedor_segmentos WHERE fornecedor_id = ?', [id]);

    // Telefones novos
    for (const t of telefones) {
      if (!t.numero) continue;
      await exec(
        `INSERT INTO fornecedor_telefones (fornecedor_id, numero, whatsapp)
         VALUES (?, ?, ?)`,
        [id, t.numero, t.whatsapp ? 1 : 0]
      );
    }

    // Segmentos novos
    for (const segId of segmentos) {
      await exec(
        `INSERT INTO fornecedor_segmentos (fornecedor_id, segmento_id)
         VALUES (?, ?)`,
        [id, Number(segId)]
      );
    }

    await registrarLog(req.usuario.id, 'FORNECEDOR_EDITAR', `ID ${id}`);
    res.json({ sucesso: true });

  } catch (e) {
    console.error('ERRO AO ATUALIZAR FORNECEDOR:', e);
    res.status(500).json({ erro: e.message });
  }
});

// EXCLUIR FORNECEDOR
app.delete('/api/fornecedores/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id);

  try {
    await exec('DELETE FROM fornecedor_telefones WHERE fornecedor_id = ?', [id]);
    await exec('DELETE FROM fornecedor_segmentos WHERE fornecedor_id = ?', [id]);
    await exec('DELETE FROM fornecedores WHERE id = ?', [id]);

    await registrarLog(req.usuario.id, 'FORNECEDOR_EXCLUIR', `ID ${id}`);
    res.json({ sucesso: true });

  } catch (e) {
    console.error('ERRO AO EXCLUIR FORNECEDOR:', e);
    res.status(500).json({ erro: e.message });
  }
});

// LISTAR SEGMENTOS (para combo)
app.get('/api/segmentos', verificarToken, async (req, res) => {
  const r = await exec('SELECT id, nome FROM segmentos ORDER BY nome');
  res.json(r.rows);
});

// CONSULTA DE FORNECEDORES
app.get('/api/fornecedores', verificarToken, async (req, res) => {
  const { razao_social, cidade, uf, segmento } = req.query;

  let sql = `
    SELECT DISTINCT f.*
    FROM fornecedores f
  `;
  const where = [];
  const args = [];

  if (segmento) {
    sql += `
      JOIN fornecedor_segmentos fs ON fs.fornecedor_id = f.id
      JOIN segmentos s ON s.id = fs.segmento_id
    `;
    where.push('s.id = ?');
    args.push(Number(segmento));
  }

  if (razao_social) {
    where.push('f.razao_social LIKE ?');
    args.push(`%${razao_social}%`);
  }

  if (cidade) {
    where.push('f.cidade LIKE ?');
    args.push(`%${cidade}%`);
  }

  if (uf) {
    where.push('f.uf = ?');
    args.push(uf.toUpperCase());
  }

  const temFiltro =
    !!razao_social || !!cidade || !!uf || !!segmento;

  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY f.razao_social';

  if (!temFiltro) {
    sql += ' LIMIT 15';
  }

  const r = await exec(sql, args);

  // carrega telefones e segmentos (apenas do que veio)
  for (const f of r.rows) {
    const tels = await exec(
      'SELECT numero, whatsapp FROM fornecedor_telefones WHERE fornecedor_id = ?',
      [f.id]
    );

    const segs = await exec(`
      SELECT s.nome
      FROM segmentos s
      JOIN fornecedor_segmentos fs ON fs.segmento_id = s.id
      WHERE fs.fornecedor_id = ?
    `, [f.id]);

    f.telefones = tels.rows;
    f.segmentos = segs.rows.map(s => s.nome);
  }

  // total geral de fornecedores (rápido e leve)
  const totalR = await exec('SELECT COUNT(*) as total FROM fornecedores');
  const total = totalR.rows[0].total;
  
  res.json({
    total,
    dados: r.rows
  });
});

// AUTOCOMPLETE DE FORNECEDORES
app.get('/api/fornecedores/autocomplete', verificarToken, async (req, res) => {
  const q = req.query.q || '';
  const r = await exec(
    `SELECT id, razao_social
     FROM fornecedores
     WHERE razao_social LIKE ?
     ORDER BY razao_social
     LIMIT 10`,
    [`%${q}%`]
  );
  res.json(r.rows);
});

// DETALHE DO FORNECEDOR (GET POR ID)
app.get('/api/fornecedores/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const r = await exec(
      'SELECT * FROM fornecedores WHERE id = ?',
      [id]
    );

    if (!r.rows.length) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    }

    const fornecedor = r.rows[0];

    const tels = await exec(
      'SELECT numero, whatsapp FROM fornecedor_telefones WHERE fornecedor_id = ?',
      [id]
    );

    const segs = await exec(`
      SELECT s.nome
      FROM segmentos s
      JOIN fornecedor_segmentos fs ON fs.segmento_id = s.id
      WHERE fs.fornecedor_id = ?
    `, [id]);

    fornecedor.telefones = tels.rows;
    fornecedor.segmentos = segs.rows.map(s => s.nome);

    res.json(fornecedor);

  } catch (e) {
    console.error('ERRO AO BUSCAR FORNECEDOR:', e);
    res.status(500).json({ erro: e.message });
  }
});

// LISTAR
app.get('/api/listar', verificarToken, async (req, res) => {
  try {
    const r = await exec(`
      SELECT d.*, u.nome as nome_usuario
      FROM documentos d
      LEFT JOIN usuarios u ON d.usuario_id = u.id
      ORDER BY d.id DESC LIMIT 20
    `, []);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// DETALHE
app.get('/api/detalhe/:id', verificarToken, async (req, res) => {
  try {
    const r = await exec(`
      SELECT d.*, u.nome as nome_usuario
      FROM documentos d
      LEFT JOIN usuarios u ON d.usuario_id = u.id
      WHERE d.id = ?
    `, [Number(req.params.id)]);

    const doc = r.rows[0];
    if (!doc) return res.status(404).json({ erro: 'Não encontrado.' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// BUSCAR
app.get('/api/buscar', verificarToken, async (req, res) => {
  const { limite, numero, ano, processo, objeto, coordenacao } = req.query;

  try {
    let sql = `
      SELECT d.*, u.nome as nome_usuario
      FROM documentos d
      LEFT JOIN usuarios u ON d.usuario_id = u.id
    `;

    const args = [];
    const where = [];

    // Número + Ano (mais específico)
    if (numero && ano) {
      where.push('d.numero = ? AND d.ano = ?');
      args.push(Number(numero), Number(ano));
    }

    // Processo
    if (processo) {
      where.push('d.processo LIKE ?');
      args.push(`%${processo}%`);
    }

    // Objeto
    if (objeto) {
      where.push('d.objeto LIKE ?');
      args.push(`%${objeto}%`);
    }

    // Coordenação
    if (coordenacao) {
      where.push('d.coordenacao LIKE ?');
      args.push(`%${coordenacao}%`);
    }

    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY d.id DESC LIMIT ?';
    args.push(limite ? Number(limite) : 20);

    const r = await exec(sql, args);
    res.json(r.rows);

  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ==========================================================================
// 9. AUTH
// ==========================================================================

const crypto = require('crypto');
const nodemailer = require('nodemailer');

app.post('/api/esqueceu-senha', async (req, res) => {
  const { email } = req.body;

  const r = await exec(
    'SELECT id FROM usuarios WHERE email = ?',
    [email]
  );

  if (r.rows.length === 0) {
    // Não revelar se o e-mail existe
    return res.json({ sucesso: true });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await exec(
    'UPDATE usuarios SET reset_token = ?, reset_expira = ? WHERE email = ?',
    [token, expira, email]
  );

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: '"AgN" <no-reply@agenciasus.org.br>',
    to: email,
    subject: 'Redefinição de senha',
    html: `
      <p>Para redefinir sua senha, clique no link abaixo:</p>
      <p>
        <a href="${process.env.APP_URL}/resetar-senha.html?token=${token}">
          Redefinir senha
        </a>
      </p>
      <p>Este link expira em 1 hora.</p>
    `
  });

  res.json({ sucesso: true });
});

app.post('/api/resetar-senha', async (req, res) => {
  const { token, novaSenha } = req.body;

  const r = await exec(
    `SELECT id FROM usuarios
     WHERE reset_token = ?
       AND reset_expira > CURRENT_TIMESTAMP`,
    [token]
  );

  if (r.rows.length === 0) {
    return res.status(400).json({ erro: 'Token inválido ou expirado.' });
  }

  const hash = bcrypt.hashSync(novaSenha, 10);

  await exec(
    `UPDATE usuarios
     SET senha = ?, reset_token = NULL, reset_expira = NULL
     WHERE id = ?`,
    [hash, r.rows[0].id]
  );

  res.json({ sucesso: true });
});

app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const r = await exec('SELECT * FROM usuarios WHERE email = ?', [email]);
    const user = r.rows[0];

    if (!user || !bcrypt.compareSync(senha, user.senha)) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '24h' });

    await registrarLog(user.id, 'LOGIN', `Usuário ${user.nome} entrou.`);

    res.json({
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        coordenacao: user.coordenacao,
        role: user.role
      }
    });

  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ==========================================================================
// 10. ADMIN / USUÁRIOS / LOGS
// ==========================================================================

app.get('/api/usuarios', verificarToken, apenasAdmin, async (req, res) => {
  try {
    const r = await exec('SELECT id, nome, email, coordenacao, role, criadoem FROM usuarios ORDER BY nome', []);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/usuarios', verificarToken, apenasAdmin, async (req, res) => {
  const { nome, email, senha, coordenacao, role } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos.' });

  try {
    const hash = bcrypt.hashSync(senha, 10);

    await exec(
      'INSERT INTO usuarios (nome, email, senha, coordenacao, role) VALUES (?, ?, ?, ?, ?)',
      [nome, email, hash, coordenacao || null, role || 'USER']
    );

    await registrarLog(req.usuario.id, 'CRIAR_USUARIO', `Criou: ${email} (${role || 'USER'})`);
    res.json({ sucesso: true });

  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ erro: 'E-mail já cadastrado.' });
    res.status(500).json({ erro: e.message });
  }
});

app.put('/api/usuarios/:id', verificarToken, apenasAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { nome, email, senha, coordenacao, role } = req.body;

  try {
    if (senha && senha.trim() !== '') {
      const hash = bcrypt.hashSync(senha, 10);
      await exec(
        'UPDATE usuarios SET nome = ?, email = ?, senha = ?, coordenacao = ?, role = ? WHERE id = ?',
        [nome, email, hash, coordenacao, role, id]
      );
    } else {
      await exec(
        'UPDATE usuarios SET nome = ?, email = ?, coordenacao = ?, role = ? WHERE id = ?',
        [nome, email, coordenacao, role, id]
      );
    }

    await registrarLog(req.usuario.id, 'EDITAR_USUARIO', `Editou ID ${id}`);
    res.json({ sucesso: true });

  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.delete('/api/usuarios/:id', verificarToken, apenasAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) return res.status(400).json({ erro: 'Não pode se excluir.' });

  try {
    await exec('DELETE FROM usuarios WHERE id = ?', [id]);
    await registrarLog(req.usuario.id, 'DELETAR_USUARIO', `Deletou ID ${id}`);
    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.put('/api/perfil', verificarToken, async (req, res) => {
  const { nome, senha, coordenacao } = req.body;
  const id = req.usuario.id;

  try {
    if (senha && senha.trim() !== '') {
      const hash = bcrypt.hashSync(senha, 10);
      await exec('UPDATE usuarios SET nome = ?, senha = ?, coordenacao = ? WHERE id = ?', [nome, hash, coordenacao, id]);
    } else {
      await exec('UPDATE usuarios SET nome = ?, coordenacao = ? WHERE id = ?', [nome, coordenacao, id]);
    }

    await registrarLog(id, 'EDITAR_PERFIL', 'Alterou os próprios dados.');

    const r = await exec('SELECT id, nome, email, coordenacao, role FROM usuarios WHERE id = ?', [id]);
    res.json({ sucesso: true, usuario: r.rows[0] });

  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/logs', verificarToken, async (req, res) => {
  try {
    const r = await exec(`
      SELECT l.*, u.nome
      FROM logs l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      ORDER BY l.criadoem DESC LIMIT 50
    `, []);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ==========================================================================
// 11. STARTUP
// ==========================================================================

(async () => {
  try {
    await initDB();
    await seedAdmin();
    await seedSequencias2026();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log('AgN rodando na porta ' + PORT));
  } catch (e) {
    console.error("ERRO FATAL no startup:", e);
    process.exit(1);
  }
})();
