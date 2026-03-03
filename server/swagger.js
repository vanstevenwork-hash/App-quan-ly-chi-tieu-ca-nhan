const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();
const PORT = process.env.PORT || 8000;


const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '💰 Chi Tiêu Cá Nhân API',
            version: '1.0.0',
            description: 'Backend API cho ứng dụng quản lý chi tiêu cá nhân. Sử dụng nút **Authorize** để nhập JWT token sau khi đăng nhập.',
        },
        servers: [{ url: `http://localhost:${PORT}`, description: 'Local dev server' }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Nhập JWT token lấy từ /api/auth/login',
                },
            },
            schemas: {
                // ===== AUTH =====
                LoginBody: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', example: 'test@email.com' },
                        password: { type: 'string', example: '123456' },
                    },
                },
                RegisterBody: {
                    type: 'object',
                    required: ['name', 'email', 'password'],
                    properties: {
                        name: { type: 'string', example: 'Nguyễn Văn A' },
                        email: { type: 'string', example: 'test@email.com' },
                        password: { type: 'string', example: '123456' },
                    },
                },
                // ===== TRANSACTION =====
                TransactionBody: {
                    type: 'object',
                    required: ['type', 'amount', 'category'],
                    properties: {
                        type: { type: 'string', enum: ['income', 'expense'] },
                        amount: { type: 'number', example: 150000 },
                        category: { type: 'string', example: 'Ăn uống' },
                        note: { type: 'string', example: 'Ăn trưa' },
                        date: { type: 'string', format: 'date-time' },
                        paymentMethod: { type: 'string', enum: ['cash', 'card', 'transfer', 'ewallet'], example: 'cash' },
                        cardId: { type: 'string', example: null, nullable: true },
                    },
                },
                // ===== BUDGET =====
                BudgetBody: {
                    type: 'object',
                    required: ['category', 'limit', 'month', 'year'],
                    properties: {
                        category: { type: 'string', example: 'Ăn uống' },
                        limit: { type: 'number', example: 3000000 },
                        month: { type: 'integer', example: 3 },
                        year: { type: 'integer', example: 2026 },
                        icon: { type: 'string', example: '🍔' },
                        color: { type: 'string', example: '#EF4444' },
                    },
                },
                // ===== GOAL =====
                GoalBody: {
                    type: 'object',
                    required: ['name', 'targetAmount'],
                    properties: {
                        name: { type: 'string', example: 'Mua xe máy' },
                        targetAmount: { type: 'number', example: 30000000 },
                        currentAmount: { type: 'number', example: 0 },
                        deadline: { type: 'string', format: 'date', example: '2026-12-31' },
                        icon: { type: 'string', example: '🏍️' },
                        color: { type: 'string', example: '#6C63FF' },
                    },
                },
                DepositBody: {
                    type: 'object',
                    required: ['amount'],
                    properties: { amount: { type: 'number', example: 500000 } },
                },
                // ===== CARD =====
                CardBody: {
                    type: 'object',
                    required: ['bankName', 'cardType'],
                    properties: {
                        bankName: { type: 'string', example: 'Vietcombank' },
                        bankShortName: { type: 'string', example: 'VCB' },
                        cardType: { type: 'string', enum: ['debit', 'credit', 'savings', 'eWallet'] },
                        cardNumber: { type: 'string', example: '5678', description: 'Last 4 digits' },
                        cardHolder: { type: 'string', example: 'NGUYEN VAN A' },
                        balance: { type: 'number', example: 5000000 },
                        creditLimit: { type: 'number', example: 50000000 },
                        color: { type: 'string', example: '#6C63FF' },
                        bankColor: { type: 'string', example: '#007B40' },
                        isDefault: { type: 'boolean', example: false },
                    },
                },
                // response wrappers
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        data: { type: 'object' },
                    },
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Lỗi xảy ra' },
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Đăng ký / Đăng nhập' },
            { name: 'Transactions', description: 'Quản lý giao dịch' },
            { name: 'Budgets', description: 'Quản lý ngân sách' },
            { name: 'Goals', description: 'Mục tiêu tài chính' },
            { name: 'Cards', description: 'Quản lý thẻ ngân hàng' },
            { name: 'Notifications', description: 'Thông báo' },
        ],
        paths: {
            // ===================== AUTH =====================
            '/api/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'Đăng ký tài khoản mới',
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterBody' } } } },
                    responses: {
                        201: { description: 'Đăng ký thành công — trả về token' },
                        400: { description: 'Email đã tồn tại' },
                    },
                },
            },
            '/api/auth/login': {
                post: {
                    tags: ['Auth'],
                    summary: 'Đăng nhập — lấy JWT token',
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } } },
                    responses: {
                        200: { description: 'OK — copy trường `token` và paste vào Authorize' },
                        401: { description: 'Sai email/mật khẩu' },
                    },
                },
            },
            '/api/auth/me': {
                get: {
                    tags: ['Auth'],
                    summary: 'Lấy thông tin user hiện tại',
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: 'User info' }, 401: { description: 'Unauthorized' } },
                },
            },

            // ===================== TRANSACTIONS =====================
            '/api/transactions': {
                get: {
                    tags: ['Transactions'],
                    summary: 'Danh sách giao dịch (có filter)',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'type', in: 'query', schema: { type: 'string', enum: ['income', 'expense'] } },
                        { name: 'category', in: 'query', schema: { type: 'string' } },
                        { name: 'month', in: 'query', schema: { type: 'integer', example: 3 } },
                        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 } },
                        { name: 'limit', in: 'query', schema: { type: 'integer', example: 20 } },
                        { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
                    ],
                    responses: { 200: { description: 'Danh sách giao dịch' } },
                },
                post: {
                    tags: ['Transactions'],
                    summary: 'Thêm giao dịch mới',
                    security: [{ bearerAuth: [] }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TransactionBody' } } } },
                    responses: { 201: { description: 'Tạo thành công' } },
                },
            },
            '/api/transactions/summary': {
                get: {
                    tags: ['Transactions'],
                    summary: 'Tổng thu/chi theo tháng',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'month', in: 'query', schema: { type: 'integer', example: 3 } },
                        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 } },
                    ],
                    responses: { 200: { description: 'income, expense, balance' } },
                },
            },
            '/api/transactions/category-breakdown': {
                get: {
                    tags: ['Transactions'],
                    summary: 'Thống kê chi tiêu theo danh mục',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'month', in: 'query', schema: { type: 'integer' } },
                        { name: 'year', in: 'query', schema: { type: 'integer' } },
                        { name: 'type', in: 'query', schema: { type: 'string', enum: ['income', 'expense'] } },
                    ],
                    responses: { 200: { description: 'Breakdown by category' } },
                },
            },
            '/api/transactions/{id}': {
                put: {
                    tags: ['Transactions'],
                    summary: 'Cập nhật giao dịch',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TransactionBody' } } } },
                    responses: { 200: { description: 'Đã cập nhật' } },
                },
                delete: {
                    tags: ['Transactions'],
                    summary: 'Xoá giao dịch',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Đã xoá' } },
                },
            },

            // ===================== BUDGETS =====================
            '/api/budgets': {
                get: {
                    tags: ['Budgets'],
                    summary: 'Danh sách ngân sách theo tháng',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'month', in: 'query', schema: { type: 'integer', example: 3 } },
                        { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 } },
                    ],
                    responses: { 200: { description: 'Danh sách budget' } },
                },
                post: {
                    tags: ['Budgets'],
                    summary: 'Tạo ngân sách mới',
                    security: [{ bearerAuth: [] }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BudgetBody' } } } },
                    responses: { 201: { description: 'Tạo thành công' } },
                },
            },
            '/api/budgets/{id}': {
                put: {
                    tags: ['Budgets'],
                    summary: 'Cập nhật ngân sách',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BudgetBody' } } } },
                    responses: { 200: { description: 'Đã cập nhật' } },
                },
                delete: {
                    tags: ['Budgets'],
                    summary: 'Xoá ngân sách',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Đã xoá' } },
                },
            },

            // ===================== GOALS =====================
            '/api/goals': {
                get: {
                    tags: ['Goals'],
                    summary: 'Danh sách mục tiêu',
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: 'Danh sách goals' } },
                },
                post: {
                    tags: ['Goals'],
                    summary: 'Tạo mục tiêu mới',
                    security: [{ bearerAuth: [] }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoalBody' } } } },
                    responses: { 201: { description: 'Tạo thành công' } },
                },
            },
            '/api/goals/{id}': {
                put: {
                    tags: ['Goals'],
                    summary: 'Cập nhật mục tiêu',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoalBody' } } } },
                    responses: { 200: { description: 'Đã cập nhật' } },
                },
                delete: {
                    tags: ['Goals'],
                    summary: 'Xoá mục tiêu',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Đã xoá' } },
                },
            },
            '/api/goals/{id}/deposit': {
                post: {
                    tags: ['Goals'],
                    summary: 'Nạp tiền vào mục tiêu',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DepositBody' } } } },
                    responses: { 200: { description: 'Đã nạp tiêu' } },
                },
            },

            // ===================== CARDS =====================
            '/api/cards': {
                get: {
                    tags: ['Cards'],
                    summary: 'Danh sách thẻ + totalBalance + totalDebt',
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: 'Array of cards' } },
                },
                post: {
                    tags: ['Cards'],
                    summary: 'Thêm thẻ mới',
                    security: [{ bearerAuth: [] }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CardBody' } } } },
                    responses: { 201: { description: 'Thêm thành công' } },
                },
            },
            '/api/cards/{id}': {
                put: {
                    tags: ['Cards'],
                    summary: 'Cập nhật thẻ',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CardBody' } } } },
                    responses: { 200: { description: 'Đã cập nhật' } },
                },
                delete: {
                    tags: ['Cards'],
                    summary: 'Xoá thẻ (soft delete)',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Đã xoá' } },
                },
            },
            '/api/cards/{id}/set-default': {
                patch: {
                    tags: ['Cards'],
                    summary: 'Đặt thẻ làm mặc định',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Đã set default' } },
                },
            },

            // ===================== NOTIFICATIONS =====================
            '/api/notifications': {
                get: {
                    tags: ['Notifications'],
                    summary: 'Danh sách thông báo',
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: 'Array of notifications' } },
                },
            },
            '/api/notifications/read-all': {
                patch: {
                    tags: ['Notifications'],
                    summary: 'Đánh dấu tất cả đã đọc',
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: 'OK' } },
                },
            },
            '/api/notifications/clear-all': {
                delete: {
                    tags: ['Notifications'],
                    summary: 'Xoá tất cả thông báo',
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: 'OK' } },
                },
            },
            '/api/notifications/{id}/read': {
                patch: {
                    tags: ['Notifications'],
                    summary: 'Đánh dấu 1 thông báo đã đọc',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'OK' } },
                },
            },
            '/api/notifications/{id}': {
                delete: {
                    tags: ['Notifications'],
                    summary: 'Xoá 1 thông báo',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'OK' } },
                },
            },

            '/api/health': {
                get: {
                    tags: ['Auth'],
                    summary: 'Health check',
                    responses: { 200: { description: 'Server is running' } },
                },
            },
        },
    },
    apis: [],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
