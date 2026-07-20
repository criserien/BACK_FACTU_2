require('dotenv').config(); // <-- ESTA LÍNEA DEBE SER LA PRIMERA

const express = require('express');
const mysql = require('mysql2/promise'); // <-- Cambiado a la versión de promesas
const cors = require('cors'); 
const app = express();

// Middlewares - Configuración de CORS optimizada para Vercel
const allowedOrigins = [
    'http://localhost:4200',            // Desarrollo local
    'https://fact-electr.onrender.com', // Frontend real en producción (Render)
    'https://front-factu-2.vercel.app', // Frontend real en producción (Vercel)
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.indexOf(origin) !== -1;
        const isVercelPreview = origin.endsWith('.vercel.app');

        if (isAllowed || isVercelPreview) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por políticas de CORS (Vercel)'));
        }
    },
    credentials: true
})); 

app.use(express.json());

// CONFIGURACIÓN DE PARÁMETROS BASE PARA TiDB
const commonDbOptions = {
    host: process.env.DB_HOST || 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER || '2ZDrKTLDPGJvTXB.root', // El prefijo antes del punto es OBLIGATORIO
    password: process.env.DB_PASSWORD || 'uR4F9z1aNJYgMajf',
    database: process.env.DB_NAME || 'test',
    multipleStatements: true,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true 
    },
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
    enableKeepAlive: true, 
    keepAliveInitialDelay: 10000 
};

// =========================================================================
// CREACIÓN DE LOS 2 POOLS DE CONEXIÓN
// =========================================================================

// 1. Pool Principal (BD 1)
const poolConfig1 = process.env.DATABASE_URL 
    ? { uri: process.env.DATABASE_URL }
    : { ...commonDbOptions, database: process.env.DB_NAME || 'test' };

const db = mysql.createPool(poolConfig1);

// 2. Pool Secundario en TiDB (BD 2)
// Asegúrate de definir DB_NAME_2 en tu archivo .env o en las variables de Vercel/Render
const poolConfig2 = process.env.DATABASE_URL_2
    ? { uri: process.env.DATABASE_URL_2 }
    : { ...commonDbOptions, database: process.env.DB_NAME_2 || 'test2' };

const db2 = mysql.createPool(poolConfig2);

console.log('🚀 Pools de conexiones a TiDB Cloud (BD 1 y BD 2) inicializados');

// ========================================
// RUTAS Y ENDPOINTS
// ========================================

// 1. Guardar el bloque de las 9 facturas en AMBAS bases de datos paralelamente
app.post('/factura', async (req, res) => {
    const { 
        producto, cantidad, total, numero, dia, mes, anio, cliente, direc_tel, total_mayor, 
        producto2, cantidad2, total2, total_mayor2,
        producto3, cantidad3, total3, total_mayor3,
        producto4, cantidad4, total4, total_mayor4,
        producto5, cantidad5, total5, total_mayor5,
        producto6, cantidad6, total6, total_mayor6,
        producto7, cantidad7, total7, total_mayor7,
        producto8, cantidad8, total8, total_mayor8,
        producto9, cantidad9, total9, total_mayor9
    } = req.body;

    let conn1, conn2;

    try {
        // Pedir conexiones de ambos pools
        conn1 = await db.getConnection();
        conn2 = await db2.getConnection();

        // Iniciar transacciones en ambas BD
        await conn1.beginTransaction();
        await conn2.beginTransaction();

        const sqlPrincipal = `INSERT INTO facturas (producto, cantidad, total, numero, dia, mes, anio, cliente, direc_tel, total_mayor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const valuesPrincipal = [producto, cantidad, total, numero, dia, mes, anio, cliente, direc_tel, total_mayor];

        // Inserciones principales
        const [res1] = await conn1.query(sqlPrincipal, valuesPrincipal);
        const [res2] = await conn2.query(sqlPrincipal, valuesPrincipal);

        const nuevoId1 = res1.insertId;
        const nuevoId2 = res2.insertId;

        const sqlSecundarias = `
            INSERT INTO facturas2 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
            INSERT INTO facturas3 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
            INSERT INTO facturas4 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
            INSERT INTO facturas5 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
            INSERT INTO facturas6 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
            INSERT INTO facturas7 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
            INSERT INTO facturas8 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
            INSERT INTO facturas9 (id, producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?, ?);
        `;

        const valuesSecundarias1 = [
            nuevoId1, producto2, cantidad2, total2, total_mayor2,
            nuevoId1, producto3, cantidad3, total3, total_mayor3,
            nuevoId1, producto4, cantidad4, total4, total_mayor4,
            nuevoId1, producto5, cantidad5, total5, total_mayor5,
            nuevoId1, producto6, cantidad6, total6, total_mayor6,
            nuevoId1, producto7, cantidad7, total7, total_mayor7,
            nuevoId1, producto8, cantidad8, total8, total_mayor8,
            nuevoId1, producto9, cantidad9, total9, total_mayor9
        ];

        const valuesSecundarias2 = [
            nuevoId2, producto2, cantidad2, total2, total_mayor2,
            nuevoId2, producto3, cantidad3, total3, total_mayor3,
            nuevoId2, producto4, cantidad4, total4, total_mayor4,
            nuevoId2, producto5, cantidad5, total5, total_mayor5,
            nuevoId2, producto6, cantidad6, total6, total_mayor6,
            nuevoId2, producto7, cantidad7, total7, total_mayor7,
            nuevoId2, producto8, cantidad8, total8, total_mayor8,
            nuevoId2, producto9, cantidad9, total9, total_mayor9
        ];

        // Inserciones en tablas secundarias en ambas BD
        await conn1.query(sqlSecundarias, valuesSecundarias1);
        await conn2.query(sqlSecundarias, valuesSecundarias2);

        // Confirmar cambios
        await conn1.commit();
        await conn2.commit();

        res.status(201).send({ 
            message: 'Las 9 facturas han sido guardadas correctamente en ambas bases de datos', 
            id_bd1: nuevoId1,
            id_bd2: nuevoId2
        });

    } catch (error) {
        // En caso de error, hacer rollback en ambas bases de datos
        if (conn1) await conn1.rollback();
        if (conn2) await conn2.rollback();

        console.error('Error durante la transacción dual:', error);
        res.status(500).send({ message: 'Error al procesar el guardado dual', error: error.message });

    } finally {
        // Liberar las conexiones siempre
        if (conn1) conn1.release();
        if (conn2) conn2.release();
    }
});

// 2. Actualizar factura existente
app.put('/api/facturas/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        producto, cantidad, total, numero, dia, mes, anio, cliente, direc_tel, total_mayor, 
        producto2, cantidad2, total2, total_mayor2,
        producto3, cantidad3, total3, total_mayor3,
        producto4, cantidad4, total4, total_mayor4,
        producto5, cantidad5, total5, total_mayor5,
        producto6, cantidad6, total6, total_mayor6,
        producto7, cantidad7, total7, total_mayor7,
        producto8, cantidad8, total8, total_mayor8,
        producto9, cantidad9, total9, total_mayor9
    } = req.body;

    try {
        const sqlPrincipal = `
            UPDATE facturas 
            SET producto = ?, cantidad = ?, total = ?, numero = ?, dia = ?, mes = ?, anio = ?, cliente = ?, direc_tel = ?, total_mayor = ? 
            WHERE id = ?`;
        const valuesPrincipal = [producto, cantidad, total, numero, dia, mes, anio, cliente, direc_tel, total_mayor, id];

        const sqlSecundarias = `
            UPDATE facturas2 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas3 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas4 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas5 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas6 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas7 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas8 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas9 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
        `;

        const valuesSecundarias = [
            producto2, cantidad2, total2, total_mayor2, id,
            producto3, cantidad3, total3, total_mayor3, id,
            producto4, cantidad4, total4, total_mayor4, id,
            producto5, cantidad5, total5, total_mayor5, id,
            producto6, cantidad6, total6, total_mayor6, id,
            producto7, cantidad7, total7, total_mayor7, id,
            producto8, cantidad8, total8, total_mayor8, id,
            producto9, cantidad9, total9, total_mayor9, id
        ];

        await db.query(sqlPrincipal, valuesPrincipal);
        await db.query(sqlSecundarias, valuesSecundarias);

        res.json({ message: `Factura ${id} y sus detalles actualizados con éxito` });
    } catch (err) {
        console.error('Error al actualizar:', err);
        res.status(500).json({ error: 'Error al actualizar registro', detalles: err.message });
    }
});

// 3. Eliminar factura
app.delete('/api/facturas/:id', async (req, res) => {
    const idFactura = req.params.id;

    try {
        const [facturaData] = await db.query('SELECT numero FROM facturas WHERE id = ?', [idFactura]);

        if (facturaData.length === 0) {
            return res.status(404).json({ message: 'La factura no fue encontrada' });
        }

        const numeroFactura = facturaData[0].numero;
        const tablasProductos = [
            'facturas', 'facturas2', 'facturas3', 'facturas4', 'facturas5', 
            'facturas6', 'facturas7', 'facturas8', 'facturas9'
        ];

        const consultasBorradoProductos = tablasProductos.map(tabla => {
            return db.query(`DELETE FROM ${tabla} WHERE id = ?`, [numeroFactura]);
        });

        await Promise.all(consultasBorradoProductos);
        await db.query('DELETE FROM facturas WHERE id = ?', [idFactura]);

        return res.json({ message: 'La factura y todos sus productos asociados se eliminaron correctamente' });

    } catch (error) {
        console.error('Error crítico al eliminar la factura:', error);
        return res.status(500).json({ error: 'Error interno del servidor al procesar la eliminación' });
    }
});

// 4. Obtener total de registros
app.get('/api/facturas-count', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT COUNT(*) AS total FROM facturas');
        res.json({ total: rows[0].total });
    } catch (err) {
        console.error('Error en facturas-count2:', error);
        res.status(500).json({
            message: 'Error en la base de datos',
            error: error.message,
            code: error.code
    });
    }
});

// 4.1. Obtener total de registros
app.get('/api/facturas-count2', async (req, res) => {
    try {
        const [rows] = await db2.query('SELECT COUNT(*) AS total FROM facturas');
        res.json({ total: rows[0].total });
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor', detalles: err.message });
    }
});

// 5. Obtener por ID
app.get('/api/facturas/:id', async (req, res) => {
    const { id } = req.params; 
    try {
        const [rows] = await db.query('SELECT * FROM facturas WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 6. Contador por fechas
app.get('/api/facturas-count-fechas/:dia/:mes/:anio', async (req, res) => {
    const dia = parseInt(req.params.dia, 10);
    const mes = parseInt(req.params.mes, 10);
    const anio = parseInt(req.params.anio, 10);

    if (isNaN(dia) || isNaN(mes) || isNaN(anio)) {
        return res.status(400).json({ error: 'Los parámetros de fecha deben ser números enteros.' });
    }

    try {
        const [rows] = await db.query('SELECT COUNT(*) AS total FROM facturas WHERE dia = ? AND mes = ? AND anio = ?', [dia, mes, anio]);
        const totalRegistros = (rows && rows[0]) ? rows[0].total : 0;
        res.json({ total: totalRegistros });
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor', detalles: err.message });
    }
});

// 7. Consulta completa por fecha
app.get('/api/facturas-fecha/:dia/:mes/:anio', async (req, res) => {
    const dia = parseInt(req.params.dia, 10);
    const mes = parseInt(req.params.mes, 10);
    const anio = parseInt(req.params.anio, 10);

    if (isNaN(dia) || isNaN(mes) || isNaN(anio)) {
        return res.status(400).json({ error: 'Los parámetros de fecha deben ser números válidos.' });
    }

    try {
        const [facturasPrincipales] = await db.query('SELECT * FROM facturas WHERE dia = ? AND mes = ? AND anio = ?', [dia, mes, anio]);

        if (!facturasPrincipales || facturasPrincipales.length === 0) {
            return res.status(404).json({ message: 'No se encontraron facturas' });
        }

        const resultadosCompletos = await Promise.all(
            facturasPrincipales.map(async (factura) => {
                const idRef = factura.id;
                factura.detallesOpcionales = {};

                for (let i = 2; i <= 9; i++) {
                    try {
                        const [rows] = await db.query(`SELECT * FROM facturas${i} WHERE id = ?`, [idRef]);
                        factura.detallesOpcionales[`factura${i}`] = rows[0] || null;
                    } catch (subErr) {
                        factura.detallesOpcionales[`factura${i}`] = null;
                    }
                }
                return factura;
            })
        );

        res.json(resultadosCompletos);
    } catch (err) {
        console.error("❌ Error en lectura:", err);
        res.status(500).json({ error: 'Error interno del servidor', detalles: err.message });
    }
});

// 8. Total clientes por nombre
app.get('/api/facturas-premio/:cliente', async (req, res) => {
    const { cliente } = req.params;
    try {
        const [rows] = await db.query('SELECT COUNT(*) AS total_clientes FROM facturas WHERE cliente LIKE ?;', [`%${cliente}%`]);
        res.json({ total_clientes: rows[0].total_clientes });
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 9. Facturas secundarias individuales (2 al 9)
for (let i = 2; i <= 9; i++) {
    app.get(`/api/facturas${i}/:id`, async (req, res) => {
        const { id } = req.params;
        try {
            const [rows] = await db.query(`SELECT * FROM facturas${i} WHERE id = ?`, [id]);
            if (rows.length === 0) { return res.status(404).json({ message: 'Registro no encontrado' }); }
            res.json(rows[0]);
        } catch (err) {
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });
}

// GET - Traer facturas por fecha desde BD2
app.get('/api/facturas-fecha-db2/:dia/:mes/:anio', async (req, res) => {
    const { dia, mes, anio } = req.params;
    try {
        const [rows] = await db2.query('SELECT * FROM facturas WHERE dia = ? AND mes = ? AND anio = ?', [dia, mes, anio]);
        if (!rows || rows.length === 0) return res.status(404).json({ message: 'No se encontraron facturas en BD2' });
        
        // Cargar detalles opcionales desde BD2
        const resultados = await Promise.all(rows.map(async (factura) => {
            factura.detallesOpcionales = {};
            for (let i = 2; i <= 9; i++) {
                try {
                    const [sub] = await db2.query(`SELECT * FROM facturas${i} WHERE id = ?`, [factura.id]);
                    factura.detallesOpcionales[`factura${i}`] = sub[0] || null;
                } catch {
                    factura.detallesOpcionales[`factura${i}`] = null;
                }
            }
            return factura;
        }));
        res.json(resultados);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Conteo por fecha desde BD2
app.get('/api/facturas-count-fechas-db2/:dia/:mes/:anio', async (req, res) => {
    const { dia, mes, anio } = req.params;
    try {
        const [rows] = await db2.query('SELECT COUNT(*) AS total FROM facturas WHERE dia = ? AND mes = ? AND anio = ?', [dia, mes, anio]);
        res.json({ total: rows[0]?.total || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT - Actualizar factura en BD2
app.put('/api/facturas-db2/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    try {
        const sqlPrincipal = `UPDATE facturas SET producto = ?, cantidad = ?, total = ?, numero = ?, dia = ?, mes = ?, anio = ?, cliente = ?, direc_tel = ?, total_mayor = ? WHERE id = ?`;
        const valuesPrincipal = [body.producto, body.cantidad, body.total, body.numero, body.dia, body.mes, body.anio, body.cliente, body.direc_tel, body.total_mayor, id];

        const sqlSecundarias = `
            UPDATE facturas2 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas3 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas4 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas5 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas6 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas7 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas8 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
            UPDATE facturas9 SET producto = ?, cantidad = ?, total = ?, total_mayor = ? WHERE id = ?;
        `;
        const valuesSecundarias = [
            body.producto2, body.cantidad2, body.total2, body.total_mayor2, id,
            body.producto3, body.cantidad3, body.total3, body.total_mayor3, id,
            body.producto4, body.cantidad4, body.total4, body.total_mayor4, id,
            body.producto5, body.cantidad5, body.total5, body.total_mayor5, id,
            body.producto6, body.cantidad6, body.total6, body.total_mayor6, id,
            body.producto7, body.cantidad7, body.total7, body.total_mayor7, id,
            body.producto8, body.cantidad8, body.total8, body.total_mayor8, id,
            body.producto9, body.cantidad9, body.total9, body.total_mayor9, id
        ];

        await db2.query(sqlPrincipal, valuesPrincipal);
        await db2.query(sqlSecundarias, valuesSecundarias);
        res.json({ message: `Factura ${id} actualizada en BD2` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE - Eliminar en BD2
app.delete('/api/facturas-db2/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const tablas = ['facturas', 'facturas2', 'facturas3', 'facturas4', 'facturas5', 'facturas6', 'facturas7', 'facturas8', 'facturas9'];
        for (const tabla of tablas) {
            await db2.query(`DELETE FROM ${tabla} WHERE id = ?`, [id]);
        }
        res.json({ message: 'Eliminado correctamente de BD2' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LEVANTAR EN LOCAL O EXPORTAR
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000; 
    app.listen(PORT, () => {
        console.log(`✅ Servidor Express corriendo localmente en el puerto ${PORT}`);
    });
}

module.exports = app;