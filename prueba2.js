require('dotenv').config(); // <-- ESTA LÍNEA DEBE SER LA PRIMERA

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors'); 
const app = express();

// Middlewares
const allowedOrigins = [
    'http://localhost:4200',            // Desarrollo local
    'https://fact-electr.onrender.com', // Frontend real en producción 
    'https://front-factu-2.vercel.app',
    process.env.FRONTEND_URL
].filter(Boolean); // Filtramos valores undefined o vacíos de forma segura

app.use(cors({
    origin: function (origin, callback) {
        // Permite peticiones sin origen (como Postman o llamadas internas del mismo servidor)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por políticas de CORS (Vercel)'));
        }
    }
})); 

app.use(express.json());

// 1. CONFIGURACIÓN DEL POOL DE CONEXIONES (Hacia TiDB Cloud usando URL)
const poolConfig = process.env.DATABASE_URL 
    ? { uri: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'gateway01.us-east-1.prod.aws.tidbcloud.com', 
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'test',
        port: parseInt(process.env.DB_PORT) || 4000, 
      };

// Añadimos las configuraciones globales necesarias para TiDB
const db = mysql.createPool({
    ...poolConfig,
    multipleStatements: true, // Se mantiene activo para el endpoint de guardado por lotes (POST)
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true 
    },
    waitForConnections: true,
    connectionLimit: 10,       
    queueLimit: 0,
    enableKeepAlive: true,     
    keepAliveInitialDelay: 10000 
});

console.log('🚀 Pool de conexiones a TiDB Cloud inicializado correctamente');

// ========================================
// RUTAS Y ENDPOINTS
// ========================================

// Guardar el bloque de las 9 facturas de un solo golpe
app.post('/factura', (req, res) => {
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

    const sql = `
        INSERT INTO facturas (producto, cantidad, total, numero, dia, mes, anio, cliente, direc_tel, total_mayor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        INSERT INTO facturas2 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
        INSERT INTO facturas3 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
        INSERT INTO facturas4 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
        INSERT INTO facturas5 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
        INSERT INTO facturas6 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
        INSERT INTO facturas7 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
        INSERT INTO facturas8 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
        INSERT INTO facturas9 (producto, cantidad, total, total_mayor) VALUES (?, ?, ?, ?);
    `;

    const values = [
        producto, cantidad, total, numero, dia, mes, anio, cliente, direc_tel, total_mayor,
        producto2, cantidad2, total2, total_mayor2,
        producto3, cantidad3, total3, total_mayor3,
        producto4, cantidad4, total4, total_mayor4,
        producto5, cantidad5, total5, total_mayor5,
        producto6, cantidad6, total6, total_mayor6,
        producto7, cantidad7, total7, total_mayor7,
        producto8, cantidad8, total8, total_mayor8,
        producto9, cantidad9, total9, total_mayor9
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error al insertar facturas:', err);
            return res.status(500).send({ message: 'Error al guardar', error: err.message });
        }
        res.status(201).send({ message: 'Las 9 facturas han sido guardadas correctamente' });
    });
});

// Obtener el total de registros en la tabla facturas
app.get('/api/facturas-count', (req, res) => {
    const query = 'SELECT COUNT(*) AS total FROM facturas';

    db.query(query, (err, rows) => {
        if (err) {
            console.error('Error al contar las facturas:', err);
            return res.status(500).json({ error: 'Error interno del servidor', detalles: err.message });
        }
        const totalRegistros = rows[0].total;
        res.json({ total: totalRegistros });
    });
});

// Obtener un registro por ID
app.get('/api/facturas/:id', (req, res) => {
    const { id } = req.params; 
    const query = 'SELECT * FROM facturas WHERE id = ?';

    db.query(query, [id], (err, rows) => {
        if (err) {
            console.error('Error al obtener el registro:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }
        res.json(rows[0]); 
    });
});

// Obtener el total de registros de fechas en la tabla facturas (Seguro y tipado)
app.get('/api/facturas-count-fechas/:dia/:mes/:anio', (req, res) => {
    const dia = parseInt(req.params.dia, 10);
    const mes = parseInt(req.params.mes, 10);
    const anio = parseInt(req.params.anio, 10);

    if (isNaN(dia) || isNaN(mes) || isNaN(anio)) {
        return res.status(400).json({ error: 'Los parámetros de fecha deben ser números enteros válidos.' });
    }

    const query = 'SELECT COUNT(*) AS total FROM facturas WHERE dia = ? AND mes = ? AND anio = ?';

    db.query(query, [dia, mes, anio], (err, rows) => {
        if (err) {
            console.error('❌ Error en SQL (facturas-count-fechas):', err.message);
            return res.status(500).json({ error: 'Error interno del servidor', detalles: err.message });
        }
        const totalRegistros = (rows && rows[0]) ? rows[0].total : 0;
        res.json({ total: totalRegistros });
    });
});

// FACTURA COMPLETA POR FECHA: Une la factura principal con sus datos asociados de las tablas 2 a 9
app.get('/api/facturas-fecha/:dia/:mes/:anio', (req, res) => {
    const dia = parseInt(req.params.dia, 10);
    const mes = parseInt(req.params.mes, 10);
    const anio = parseInt(req.params.anio, 10);

    if (isNaN(dia) || isNaN(mes) || isNaN(anio)) {
        return res.status(400).json({ error: 'Los parámetros de fecha deben ser números enteros válidos.' });
    }

    const queryPrincipal = 'SELECT * FROM facturas WHERE dia = ? AND mes = ? AND anio = ?';

    db.query(queryPrincipal, [dia, mes, anio], (err, facturasPrincipales) => {
        if (err) {
            console.error('❌ Error en SQL (facturas-fecha principal):', err.message);
            return res.status(500).json({ error: 'Error interno del servidor', detalles: err.message });
        }
        
        if (!facturasPrincipales || facturasPrincipales.length === 0) {
            return res.status(404).json({ message: 'No se encontraron facturas' });
        }

        // Buscamos los datos relacionados de forma asíncrona e individual para cada factura encontrada
        const promesas = facturasPrincipales.map(factura => {
            return new Promise((resolve) => {
                const idRef = factura.id;
                
                // Arreglo para almacenar las 8 promesas correspondientes a las subtablas
                const consultasTablas = [];
                for (let i = 2; i <= 9; i++) {
                    consultasTablas.push(
                        new Promise((resSub) => {
                            db.query(`SELECT * FROM facturas${i} WHERE id = ?`, [idRef], (subErr, rows) => {
                                if (subErr) {
                                    console.error(`⚠️ Error al consultar facturas${i} para ID ${idRef}:`, subErr.message);
                                    resSub(null); // No rompemos toda la ejecución si falla una subtabla, enviamos null
                                } else {
                                    resSub(rows && rows[0] ? rows[0] : null);
                                }
                            });
                        })
                    );
                }

                // Esperamos que se ejecuten las 8 subconsultas de esta factura en paralelo
                Promise.all(consultasTablas).then((resultados) => {
                    factura.detallesOpcionales = {
                        factura2: resultados[0],
                        factura3: resultados[1],
                        factura4: resultados[2],
                        factura5: resultados[3],
                        factura6: resultados[4],
                        factura7: resultados[5],
                        factura8: resultados[6],
                        factura9: resultados[7]
                    };
                    resolve(factura);
                });
            });
        });

        // Resolvemos todo y enviamos la respuesta al cliente
        Promise.all(promesas)
            .then(resultadosCompletos => {
                res.json(resultadosCompletos);
            })
            .catch(pErr => {
                console.error("❌ Error inesperado procesando resultados completos:", pErr);
                res.status(500).json({ error: 'Error al compilar detalles de las facturas' });
            });
    });
});

// Obtener el total de clientes por coincidencia de nombre
app.get('/api/facturas-premio/:cliente', (req, res) => {
    const { cliente } = req.params;
    const query = 'SELECT COUNT(*) AS total_clientes FROM facturas WHERE cliente LIKE ?;';

    db.query(query, [`%${cliente}%`], (err, rows) => {
        if (err) {
            console.error('Error al contar los clientes:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        const totalClientes = rows[0].total_clientes;
        res.json({ total_clientes: totalClientes });
    });
});

// FACTURAS 2 AL 9 (Endpoints individuales por si se necesitan consultar de forma aislada)
for (let i = 2; i <= 9; i++) {
    app.get(`/api/facturas${i}/:id`, (req, res) => {
        const { id } = req.params;
        const query = `SELECT * FROM facturas${i} WHERE id = ?`;

        db.query(query, [id], (err, rows) => {
            if (err) {
                console.error(`Error al obtener factura ${i}:`, err);
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Registro no encontrado' });
            }
            res.json(rows[0]);
        });
    });
}

// 2. MODIFICACIÓN PARA LEVANTAR EN LOCAL Y EXPORTAR PARA VERCEL
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000; 
    app.listen(PORT, () => {
        console.log(`✅ Servidor Express corriendo localmente en el puerto ${PORT}`);
    });
}

// Exportamos la app para que Vercel la tome como una Serverless Function
module.exports = app;