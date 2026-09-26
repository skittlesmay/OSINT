# 🌐 OSINT Platform: Distributed Intelligence & Graph Correlation Engine

Исследовательский проект, сфокусированный на бэкенд-архитектуре, глубоком изучении графовых СУБД (Neo4j), гибридного хранения данных (**Polyglot Persistence**) и проектировании асинхронных пайплайнов сбора информации на NestJS.

[Backend (Основной сервис) →](./backend/README.md) | [Frontend (Шаблон / WIP) →](./frontend/README.md)

---

## Архитектурный обзор

Основной упор проекта сделан на серверную инженерию: обработку очередей через RabbitMQ, интеграцию обхода Cloudflare (FlareSolverr), стриминг промежуточных результатов через WebSockets и семантический анализ цифрового следа с построением графа связей в Neo4j.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#181825', 'primaryTextColor': '#cdd6f4', 'primaryBorderColor': '#89b4fa', 'lineColor': '#f38ba8', 'clusterBkg': '#11111b', 'clusterBorder': '#89b4fa'}}}%%
flowchart TD
    Consumer["API Consumers / Swagger / Future UI"]
    
    subgraph Gateway_Layer["Транспортный уровень"]
        HTTP_API["HTTP / REST Endpoints"]
        WS_Gateway["WebSocket Gateway (Socket.io)"]
    end

    subgraph Core_Layer["Сервисный уровень (NestJS 11)"]
        InvController["Investigations Controller"]
        InvService["Investigations Service"]
        AppService["OSINT Execution Service"]
        TasksService["Cron Monitoring Service"]
    end

    subgraph Messaging["Асинхронные очереди"]
        RMQ["RabbitMQ (investigations_queue)"]
    end

    subgraph Scraping["Сбор данных и обход защит"]
        FlareSolverr["FlareSolverr Proxy Engine"]
        Target_GH["GitHub"]
        Target_Steam["Steam Community"]
        Target_PB["Pastebin"]
    end

    subgraph Storage["Слой хранения (Polyglot Persistence)"]
        Postgres[("PostgreSQL 16 (Prisma ORM)")]
        Neo4j[("Neo4j 5.12 (Graph Engine)")]
    end

    Consumer -->|REST API Requests| HTTP_API
    Consumer -->|WebSocket Subscriptions| WS_Gateway
    WS_Gateway -->|Real-time Events| Consumer
    
    HTTP_API --> InvController
    InvController --> InvService
    InvService -->|Publish search.start| RMQ
    
    RMQ -->|Consume event| AppService
    TasksService -->|Scheduled poll| AppService
    
    AppService -->|Bypass requests| FlareSolverr
    FlareSolverr --> Target_GH
    FlareSolverr --> Target_Steam
    FlareSolverr --> Target_PB
    
    AppService -->|Save artifacts & state| Postgres
    AppService -->|Build relations & Cypher queries| Neo4j
    AppService -->|Push real-time updates| WS_Gateway

    classDef client fill:#313244,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4;
    classDef core fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef broker fill:#181825,stroke:#fab387,stroke-width:2px,color:#cdd6f4;
    classDef external fill:#11111b,stroke:#f38ba8,stroke-width:2px,color:#cdd6f4;
    classDef database fill:#181825,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4;

    class Consumer client;
    class HTTP_API,WS_Gateway,InvController,InvService,AppService,TasksService core;
    class RMQ broker;
    class FlareSolverr,Target_GH,Target_Steam,Target_PB external;
    class Postgres,Neo4j database;
```

---

## Ключевые архитектурные решения

- **Графовый анализ взаимосвязей (Neo4j & Cypher)**: Использование графовой модели данных для сопоставления разрозненных аккаунтов, мест работы, локаций и биографий с объединением в семантическую сеть.
- **Гибридное хранение (Polyglot Persistence)**: Разделение зон ответственности: реляционная БД (PostgreSQL 16 + Prisma) хранит метаданные расследований, сессии и сырые артефакты, а Neo4j вычисляет топологию графа.
- **Асинхронная архитектура (RabbitMQ)**: Декомпозиция входящих HTTP-запросов и тяжелых задач скрейпинга через брокер очередей.
- **Обход Cloudflare (FlareSolverr)**: Интеграция прокси-движка для преодоления WAF и антибот-проверок целевых платформ.
- **Реактивный стриминг (Socket.io)**: WebSocket-шлюз с комнатами по `investigationId` для доставки промежуточного прогресса и найденных артефактов без блокирующего поллинга.
- **Фоновый мониторинг (@nestjs/schedule)**: Cron-сервис регулярного обновления целевых профилей с контролем лимитов выполнения.

---

## Стек технологий

| Слой | Технология | Назначение |
| :--- | :--- | :--- |
| Backend Runtime | Node.js / TypeScript | Серверная среда исполнения |
| Framework | NestJS 11 | Архитектура, контроллеры, сервисы и микросервисы |
| Graph Database | Neo4j 5.12 Community | Хранение семантического графа связей и Cypher-запросы |
| Relational Storage | PostgreSQL 16 | Хранение состояний, пользователей и сырых артефактов |
| ORM Layer | Prisma 7 + @prisma/adapter-pg | Типобезопасный доступ к PostgreSQL |
| Message Broker | RabbitMQ 3 | Асинхронная очередь задач сбора (`search.start`) |
| Real-time | WebSockets / Socket.io | Стриминг прогресса расследования |
| Anti-Bot Proxy | FlareSolverr + Cheerio | Проксирование запросов и парсинг HTML |
| Scheduler | @nestjs/schedule | Периодические задачи циклического мониторинга |
| Authentication | Better Auth | Подсистема аутентификации и сессий |
| Infrastructure | Docker & Docker Compose | Контейнеризация PostgreSQL, RabbitMQ, Neo4j, FlareSolverr |
| Frontend | React 19 + Vite (WIP) | Базовый каркас клиента под будущую визуализацию |

---

## Топология графовой модели данных

В графовой базе Neo4j аккумулируются связи между сущностями:

```
(:Investigation) --[:HAS_ACCOUNT]--> (:Account)
(:Account) --[:WORKED_IN]--> (:Company)
(:Account) --[:LOCATED_IN]--> (:Location)
(:Account) --[:ACCOUNT_BIO]--> (:Bio)
```

Пример Cypher-запроса из кодовой базы для извлечения сетевых взаимосвязей цели:
```cypher
MATCH (i:Investigation {id: $id})-[r:HAS_ACCOUNT]->(a:Account)
RETURN a.source AS source, a.url AS url;
```

---

## Быстрый старт

### Требования
- Docker и Docker Compose
- Node.js >= 20.x
- pnpm >= 9.x

### 1. Подготовка окружения
```bash
git clone https://github.com/platon453/OSINT.git
cd OSINT
cp .env.example .env
```

### 2. Запуск контейнеров инфраструктуры
```bash
docker compose up -d
```

Панели управления сервисами:
- Neo4j Browser: `http://localhost:7474`
- RabbitMQ Management: `http://localhost:15672` (guest / guest)
- FlareSolverr: `http://localhost:8191`
- PostgreSQL: порт `5432`

### 3. Запуск основного сервиса (Backend)
```bash
cd backend
pnpm install
npx prisma migrate dev
pnpm run start:dev
```
API доступно на `http://localhost:3000`.  
Интерактивная Swagger-документация: `http://localhost:3000/api/docs`.

---

## Структура репозитория

```
├── backend/                  # Основной сервис: NestJS, воркеры, Prisma, Neo4j
│   ├── prisma/               # Схема Prisma и миграции PostgreSQL
│   ├── src/
│   │   ├── auth/             # Модуль аутентификации Better Auth
│   │   ├── investigations/   # Контроллеры, RabbitMQ и WebSocket Gateway
│   │   ├── neo4j/            # Сервис работы с графовой СУБД (Cypher)
│   │   ├── prisma/           # Доступ к PostgreSQL
│   │   └── tasks/            # Фоновый мониторинг по расписанию (Cron)
│   └── test/                 # Тестовые сценарии
├── frontend/                 # Каркас SPA-клиента (Vite, React 19, заготовка)
├── docker-compose.yaml       # Инфраструктура (Postgres, RabbitMQ, Neo4j, FlareSolverr)
├── .env.example              # Шаблон конфигурации переменных окружения
└── README.md                 # Документация проекта
```

---

## Лицензия

Проект распространяется под лицензией MIT. Подробности в файле [LICENSE](./LICENSE).
