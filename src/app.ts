import express, { Application, Request, Response, NextFunction } from "express";
const mysql = require('mysql');
const path = require("path");
const { v4: uuidv4 } = require('uuid');

const app: express.Application = express();
const db = mysql.createConnection({
    host : 'localhost',
    user : 'root',
    password: '1234',
    database: 'devint_db'
})

db.connect((err: any) => {
    if(err) throw err;
    console.log('MySQL Connected...')
})

// Routes 
app.get( "/", (req: Request, res: Response, next: NextFunction) => {
    res.sendFile(path.join(__dirname,'./public/index.html'));
} );

app.get('/create_payment_note', (req: Request, res: Response) => {
    let uuid = uuidv4();
    // let periodfrom = req.query.periodfrom.replace('T',' ');
    // let periodto = req.query.periodto.replace('T',' ');

    let periodfrom;
    if (req.query && req.query.periodfrom) { periodfrom = (req.query as any).periodfrom.replace('T',' '); }
    let periodto;
    if (req.query && req.query.periodfrom) { periodto = (req.query as any).periodto.replace('T',' '); }

    let payment_note = {
        payment_note_uuid: uuid,
	    payment_note_period_from_datetime: periodfrom,
	    payment_note_period_to_datetime: periodto,
	    payment_note_created_datetime: mysql.raw('CURRENT_TIMESTAMP()'),
	    payment_note_transactions_count: '0',
	    payment_note_value: '0',
	    payment_note_status_code: 'CREATING'
    };
    let sql = 'INSERT INTO payment_note SET ?';
    db.query(sql, payment_note, (err: any, result: any) => {
        if(err) throw err;
        console.log(result);
        res.redirect('back')
    }); 

    // Update affected transactions
    let update_transaction_sql = `
        UPDATE transaction 
        SET transaction_status_code='PAID', transaction_payment_note_uuid='${uuid}'
        WHERE transaction_datetime BETWEEN '${periodfrom}' AND '${periodto}' AND transaction_status_code='PENDING'
    `;
    db.query(update_transaction_sql, (err: any, result: any) => {
        if(err) throw err;
        console.log(result);
    });

    // Update payment_note
    let update_payment_note_queries = ` 
    UPDATE payment_note t1 JOIN
    (
        SELECT COUNT(1) AS number, IFNULL(SUM(transaction_value),0) AS total_value
        FROM payment_note AS p INNER JOIN transaction AS t
        ON p.payment_note_uuid = t.transaction_payment_note_uuid
        WHERE p.payment_note_uuid = '${uuid}'
    ) t2 
    SET t1.payment_note_transactions_count = t2.number, t1.payment_note_value = t2.total_value,
    payment_note_status_code = 'COMPLETED'
    WHERE t1.payment_note_uuid = '${uuid}'
    `;
    db.query(update_payment_note_queries, (err: any, result: any) => {
        if(err) throw err;
        console.log(result);
    });  
})

// Create an API/Endpoint where a user can query all payment_notes
app.get('/get_all_payment_note', (req: Request, res: Response) => {
    let all_pay_queries = ` 
        SELECT * 
        FROM payment_note 
    `;
    db.query(all_pay_queries, (err: any, result: any) => {
        if(err) throw err;
        res.send(result);
    });
});

// Create an API/Endpoint where the user can query a specific payment_note and get back all transaction 
// referenced/related to the payment_note_uuid
app.get('/get_payment_by_uuid', (req: Request, res: Response) => {
    let get_by_id_query = ` 
        SELECT * 
        FROM transaction
        WHERE transaction_payment_note_uuid='${req.query.uuid}'
    `;
    db.query(get_by_id_query, (err: any, result: any) => {
        if(err) throw err;
        res.send(result);
    });
});

app.listen('3000', () => {
    console.log('Sever started on port 3000')
})