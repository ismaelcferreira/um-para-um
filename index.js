import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());


const pool = new Pool({
  user: 'postgres',          
  host: 'localhost',
  database: 'um-para-um',
  password: 'senai',    
  port: 5432,
});

// ==========================================
// 1. ROTA GET (Listar todas as pessoas com CPF)
// ==========================================
app.get('/pessoas', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id, 
        p.nome, 
        p.email, 
        c.id AS cpf_id, 
        c.numero_cpf
      FROM pessoas p
      LEFT JOIN cpfs c ON p.id = c.pessoa_id
      ORDER BY p.id ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao procurar pessoas.' });
  }
});

// ==========================================
// 2. ROTA GET POR ID (Buscar apenas uma pessoa)
// ==========================================
app.get('/pessoas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT 
        p.id, 
        p.nome, 
        p.email, 
        c.id AS cpf_id, 
        c.numero_cpf
      FROM pessoas p
      LEFT JOIN cpfs c ON p.id = c.pessoa_id
      WHERE p.id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pessoa não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao procurar pessoa.' });
  }
});

// ==========================================
// 3. ROTA POST (Cadastrar Pessoa + CPF)
// ==========================================
app.post('/pessoas', async (req, res) => {
  const { nome, email, numero_cpf } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); 

    
    const resPessoa = await client.query(
      'INSERT INTO pessoas (nome, email) VALUES ($1, $2) RETURNING *',
      [nome, email]
    );
    const novaPessoa = resPessoa.rows[0];

   
    const resCpf = await client.query(
      'INSERT INTO cpfs (numero_cpf, pessoa_id) VALUES ($1, $2) RETURNING *',
      [numero_cpf, novaPessoa.id]
    );

    await client.query('COMMIT'); 

    res.status(201).json({
      id: novaPessoa.id,
      nome: novaPessoa.nome,
      email: novaPessoa.email,
      cpf_id: resCpf.rows[0].id,
      numero_cpf: resCpf.rows[0].numero_cpf,
    });
  } catch (err) {
    await client.query('ROLLBACK'); 
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar pessoa e CPF.' });
  } finally {
    client.release(); 
  }
});

// ==========================================
// 4. ROTA PUT (Atualizar Pessoa + CPF)
// ==========================================
app.put('/pessoas/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, email, numero_cpf } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

   
    const resPessoa = await client.query(
      'UPDATE pessoas SET nome = $1, email = $2 WHERE id = $3 RETURNING *',
      [nome, email, id]
    );

    if (resPessoa.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pessoa não encontrada.' });
    }

   
    const resCpf = await client.query(
      'UPDATE cpfs SET numero_cpf = $1 WHERE pessoa_id = $2 RETURNING *',
      [numero_cpf, id]
    );

    await client.query('COMMIT');

    res.json({
      id: resPessoa.rows[0].id,
      nome: resPessoa.rows[0].nome,
      email: resPessoa.rows[0].email,
      numero_cpf: resCpf.rows[0] ? resCpf.rows[0].numero_cpf : null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar dados.' });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. ROTA DELETE (Excluir Pessoa)
// ==========================================
app.delete('/pessoas/:id', async (req, res) => {
  const { id } = req.params;
  try {
   
    const result = await pool.query('DELETE FROM pessoas WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pessoa não encontrada.' });
    }

    res.json({ message: 'Pessoa e CPF apagados com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar pessoa.' });
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});