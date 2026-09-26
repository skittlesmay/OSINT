# ⚡ OSINT Backend Core: API, Event Pipeline & Graph Engine

Серверный сервис платформы цифровой разведки (OSINT), реализующий асинхронную обработку очередей сбора данных, обход антифрод-систем, стриминг событий в реальном времени и корреляционный анализ сетевых структур на базе графовой СУБД Neo4j.

---

## Архитектура и стек технологий

Архитектура построена на принципах Clean Architecture и модульности NestJS:
- **NestJS 11**: Модульный фреймворк с инверсией управления (IoC) и внедрением зависимостей (DI).
- **Neo4j Driver 6 & Cypher**: Высокопроизводительный доступ к графовой СУБД для построения сетей связей между узлами.
- **Prisma 7 + PostgreSQL 16**: Реляционный слой с адаптером `@prisma/adapter-pg` для управления состоянием расследований, пользователями и сессиями.
- **RabbitMQ (@nestjs/microservices)**: Брокер сообщений для изоляции задач сбора информации от HTTP-потока.
- **Socket.io (@nestjs/websockets)**: Двусторонний транспорт для отправки промежуточных результатов в браузер.
- **FlareSolverr + Cheerio + Axios**: Стек сбора данных с эмуляцией браузера для обхода Cloudflare WAF.
- **Better Auth**: Модуль управления сессиями и аутентификацией пользователей.
- **@nestjs/schedule**: Планировщик фоновых регламентных задач (Cron).

---

## Графовая подсистема (Neo4j & Cypher)

Ключевым преимуществом платформы является семантическая корреляция разрозненных цифровых следов в единый граф связей. Реляционные таблицы фиксируют сырые артефакты, в то время как Neo4j отвечает за выявление скрытых взаимосвязей, кластеризацию и сетевой анализ.

### Топология графа

```
                      +-------------------+
                      |   Investigation   |
                      +-------------------+
                                |
                         [:HAS_ACCOUNT]
                                |
                                v
                       +-----------------+
                       |     Account     |
                       +-----------------+
                         /      |      \
             [:WORKED_IN]  [:LOCATED_IN] [:ACCOUNT_BIO]
             /                  |                  \
            v                   v                   v
     +-------------+    +---------------+    +-------------+
     |   Company   |    |   Location    |    |     Bio     |
     +-------------+    +---------------+    +-------------+
```

### Модели узлов (Nodes)
- `Investigation`: корневой узел сессии расследования (`id`, `target`, `type`).
- `Account`: учетная запись на внешнем ресурсе (`source`, `url`).
- `Company`: организация, извлеченная из метаданных профиля (`companyName`).
- `Location`: геопозиция или заявленная локация пользователя (`name`).
- `Bio`: биографическое описание профиля (`bioInformation`).

### Ребра и семантические связи (Relationships)
- `(:Investigation)-[:HAS_ACCOUNT]->(:Account)`: связь расследования с обнаруженным аккаунтом.
- `(:Account)-[:WORKED_IN]->(:Company)`: сопоставление аккаунта с компанией-работодателем.
- `(:Account)-[:LOCATED_IN]->(:Location)`: географическая привязка профиля.
- `(:Account)-[:ACCOUNT_BIO]->(:Bio)`: связь профиля с текстовой биографией.

### Cypher-запросы ядра

1. **Инициализация расследования и мердж узла**:
```cypher
MERGE (i:Investigation {id: $id, target: $target, type: $type})
```

2. **Создание аккаунта и привязка к расследованию**:
```cypher
MATCH (i:Investigation {id: $investigationId})
MERGE (a:Account {source: $source, url: $url})
MERGE (i)-[:HAS_ACCOUNT]->(a)
```

3. **Связывание аккаунта с компанией и локацией (идемпотентная вставка)**:
```cypher
MERGE (a:Account {source: $source, url: $url})
MERGE (c:Company {companyName: $company})
MERGE (a)-[:WORKED_IN]->(c)
```

4. **Выборка сетевого графа расследования**:
```cypher
MATCH (i:Investigation {id: $id})-[r:HAS_ACCOUNT]->(a:Account)
RETURN a.source AS source, a.url AS url
```

Управление транзакциями инкапсулировано в `Neo4jService` с использованием сессий драйвера и метода `session.executeWrite()`.

---

## Конфигурация окружения (.env)

Файл `.env` должен располагаться в корне монорепозитория (на один уровень выше папки `backend`):

| Переменная | Тип | Назначение |
| :--- | :--- | :--- |
| `POSTGRES_USER` | string | Имя пользователя базы данных PostgreSQL |
| `POSTGRES_PASSWORD` | string | Пароль пользователя PostgreSQL |
| `POSTGRES_DB` | string | Название базы данных PostgreSQL |
| `NEO4J_URL` | string | Bolt-протокол подключения к Neo4j (`bolt://localhost:7687`) |
| `NEO4J_USER` | string | Имя пользователя Neo4j (`neo4j`) |
| `NEO4J_PASSWORD` | string | Пароль для доступа к Neo4j |
| `DATABASE_URL` | string | Полная строка подключения Prisma к PostgreSQL |

Пример конфигурации находится в файле [`.env.example`](../.env.example).

---

## Установка и запуск

### 1. Установка зависимостей
```bash
pnpm install
```

### 2. Применение миграций Prisma
```bash
# Применение миграций схемы к локальной БД
npx prisma migrate dev

# Генерация TypeScript-клиента Prisma
npx prisma generate
```

### 3. Запуск сервиса
```bash
# Режим разработки с hot-reload
pnpm run start:dev

# Сборка проекта
pnpm run build

# Продакшн запуск
pnpm run start:prod
```

---

## Спецификация REST API

Интерактивная Swagger-документация доступна по адресу: `http://localhost:3000/api/docs`.

| Метод | Путь | Описание |
| :--- | :--- | :--- |
| `POST` | `/investigations/start` | Инициализация нового расследования и отправка задачи в RabbitMQ |
| `GET` | `/investigations/status/:id` | Получение статуса расследования и списка найденных артефактов |
| `PATCH` | `/investigations/:id/toggle-monitoring` | Включение или отключение циклического фонового мониторинга |
| `GET` | `/investigations/:id/report` | Выгрузка полного досье (агрегация из PostgreSQL и графа Neo4j) |

### Параметры эндпоинта отчетов (`/investigations/:id/report`)
- `format`: формат ответа (`json` по умолчанию, `md` для Markdown-представления).
- `download`: флаг скачивания (`true` выставляет заголовок `Content-Disposition: attachment`).

---

## WebSocket Gateway (Socket.io)

Шлюз реального времени (`InvestigationsGateway`) обеспечивает стриминг статуса без необходимости поллинга HTTP-эндпоинтов.

### Входящие события от клиента
- `join_investigation!`: подключение сокета к изолированной комнате расследования (`{ "investigationId": "uuid" }`).

### Исходящие события сервиса
- `investigation_progress`: передача текущего прогресса сбора (`checked`, `total`, `percentage`).
- `artifact-found`: доставка найденного артефакта сразу после обнаружения.
- `investigation_failed`: уведомление о критическом сбое пайплайна сбора данных.

---

## Фоновый мониторинг (TasksService)

Сервис реализует регламентную проверку активных целей по расписанию:
- **Триггер**: `@Cron('0 */2 * * * *')` (запуск каждые 2 минуты).
- **Выборка**: все расследования с флагом `isMonitoring: true`.
- **Защита от перегрузки**: лимит в 10 итераций мониторинга (`monitoringCount >= 10`), после чего флаг `isMonitoring` автоматически сбрасывается в `false`.
