# Сравнение MCP для задач ревью в Figma

## Что сравниваем

В этом документе сравниваются три источника:

1. `Figma MCP Server` от Figma
2. `Figma MCP Skills` из официального гайда Figma MCP
3. `Figma Console MCP` от Southleft

Важно: `Figma MCP Skills` не являются отдельным MCP-сервером. Это набор готовых workflow и инструкций для агента, который работает поверх официального `Figma MCP Server`. Но в сравнении их полезно выделять отдельно, потому что на практике они сильно влияют на то, насколько удобно и надежно использовать официальный MCP.

## Коротко по смыслу

| Решение | Тип | Основная задача | Когда особенно полезно |
|---|---|---|---|
| Figma MCP Server | Официальный MCP-сервер | Дать AI доступ к данным из Figma, контексту дизайна, коду и действиям на canvas | Design-to-code, Code Connect, чтение структуры, создание и обновление дизайна |
| Figma MCP Skills | Workflow-слой поверх official MCP | Подсказать агенту, как правильно и последовательно использовать Figma MCP | Сложные многошаговые сценарии, где важен порядок действий |
| Figma Console MCP | Сторонний MCP-сервер | Дать много специализированных инструментов для операций в Figma, дизайн-систем и отладки плагинов | Аудит компонентов, работа с variables/tokens, maintenance, debug |

## Сравнительная таблица по возможностям

| Область | Figma MCP Server | Figma MCP Skills | Figma Console MCP |
|---|---|---|---|
| Базовая модель | Официальный сервер от Figma с набором инструментов | Не сервер, а набор workflow для official MCP | Отдельный сторонний MCP с большим числом специализированных tools |
| Подход | Более продуктовый и универсальный | Более процессный и направляющий | Более операционный и granular |
| Чтение из Figma | Да | Использует official MCP | Да |
| Запись в Figma | Да | Через official MCP workflows | Да, особенно в local mode |
| Анализ дизайна | Сильный | Сильный, если использовать нужный workflow | Сильный |
| Получение screenshots / design context | Да | Да, через official tools | Есть, но это не главное отличие |
| Работа с Code Connect | Сильная сторона | Сильная сторона | Не основной фокус |
| Работа с variables / tokens | Есть, но не всегда в виде узких инструментов | Улучшается за счет workflow | Очень сильная сторона |
| Работа с component properties | Есть | Есть через сценарии | Очень сильная сторона |
| Поиск по дизайн-системе | Да | Да | Да |
| Создание / обновление файлов и экранов | Да | Да | Да |
| FigJam / diagrams | Да | Да, через official workflows | В изученной документации не выглядит как ключевой сценарий |
| Debug / console / plugin support | Не выглядит как основной сценарий | Нет отдельного слоя | Сильная сторона |
| Надежность агентного workflow | Нормальная, но многое зависит от того, как агент пользуется tool'ами | Выше за счет инструкций и пошаговых правил | Нормальная, особенно для явных узких задач |
| Порог входа | Средний | Средний | Средний или выше из-за большого набора инструментов |

## 1. Figma MCP Server

### Что умеет

По официальной документации Figma MCP Server умеет:

- получать design context по узлу или файлу
- получать metadata и screenshots
- читать variable definitions
- искать данные в дизайн-системе
- работать с Code Connect
- создавать новые файлы
- обновлять или генерировать контент в Figma
- работать с FigJam
- генерировать диаграммы

### Сильные стороны

- Это официальный инструмент от Figma.
- Хорошо подходит для design-to-code сценариев.
- Хорошо подходит для задач, где нужно понимать структуру компонента и его связь с кодом.
- Есть сильная интеграция с Code Connect.
- Подходит для AI-агентов, которым нужно и читать дизайн, и вносить изменения.
- Покрывает не только инспекцию, но и генерацию / обновление дизайна.

### Ограничения

- Часть сценариев записи завязана на более общие инструменты вроде `use_figma`, поэтому многое зависит от того, насколько аккуратно агент формирует запрос.
- Для регулярных audit/review-задач его удобнее использовать вместе с дополнительным workflow-слоем.
- Он сильный как платформа, но не всегда самый удобный для узких операционных проверок вроде массовой валидации токенов или cleanup-задач.
- Если нужна очень granular работа с variables, scopes, assignments и maintenance, может быть менее удобным, чем специализированный MCP.

### Где особенно хорош

- перевод дизайна в код
- работа с Code Connect
- чтение структуры компонента и дизайн-контекста
- создание или обновление экранов
- официальные Figma-native сценарии для AI

## 2. Figma MCP Skills

### Что это такое

Это набор готовых workflow для агента. Среди них есть, например:

- `figma-use`
- `figma-implement-design`
- `figma-generate-design`
- `figma-create-new-file`
- `figma-generate-library`
- `figma-create-design-system-rules`
- `figma-code-connect`

Они не добавляют новый MCP API, а описывают, как агенту правильно действовать в типовых задачах.

### Что дают на практике

- помогают разбивать задачу на понятные шаги
- уменьшают хаос при использовании broad tools
- делают agent workflow более предсказуемым
- задают порядок действий и ограничения
- помогают безопаснее использовать write-heavy сценарии

### Сильные стороны

- Превращают официальный MCP из просто набора tool'ов в более управляемый workflow.
- Особенно полезны там, где одного вызова недостаточно.
- Делают поведение агента более последовательным.
- Упрощают повторяемые процессы: implementation, library generation, design generation.

### Ограничения

- Это не отдельный MCP-сервер.
- Они полностью зависят от `Figma MCP Server`.
- Без official MCP сами по себе ничего не делают.
- Не заменяют специализированные инструменты для технического аудита, debug или maintenance.

### Где особенно хороши

- многошаговые задачи
- генерация экранов из дизайн-системы
- implementation workflow
- генерация библиотек и системных правил
- повышение надежности при использовании official MCP

## 3. Figma Console MCP

### Что умеет

По документации Southleft основной упор здесь сделан на:

- большое количество специализированных tools
- работу с variables, collections, modes и assignments
- операции с component properties и instances
- прямые действия в Figma
- plugin console и debug workflow
- design-code parity
- поддержку local mode и remote mode с разным уровнем возможностей

### Сильные стороны

- Очень хорошо подходит для операционных задач.
- Удобен для ревью variables и tokens.
- Удобен для поиска detached variables и broken assignments.
- Полезен для проверок naming, scope, структуры компонентов и maintenance-задач.
- Лучше подходит для plugin debugging, чем official MCP в изученной документации.
- Хорош для библиотек компонентов и дизайн-систем, где нужно много точечных проверок и исправлений.

### Ограничения

- Это не официальный инструмент Figma.
- Документация местами не совсем консистентна по количеству tools, поэтому цифры лучше воспринимать как приблизительные.
- Возможности зависят от режима работы, особенно local vs remote.
- Из-за большого набора инструментов порог входа может быть выше.
- Он меньше сфокусирован на официальных Figma-first сценариях вроде Code Connect.

### Где особенно хорош

- аудит variables и tokens
- проверка component properties
- maintenance дизайн-системы
- автоматизация review-проверок
- plugin debugging
- cleanup и операционные задачи

## Сравнение по задачам ревью

| Задача | Figma MCP Server | Figma MCP Skills | Figma Console MCP |
|---|---|---|---|
| Проверка соответствия продукту | Сильный | Сильный, если использовать implementation/design workflows | Частично, но это не главный фокус |
| Проверка структуры компонента | Сильный | Еще сильнее в виде пошагового процесса | Очень сильный |
| Проверка variables / tokens | Нормально | Нормально | Очень сильный |
| Проверка naming | Нормально | Нормально | Очень сильный |
| Проверка visual organization | Нормально | Нормально | Сильный |
| Maintenance дизайн-системы | Нормально | Сильный | Очень сильный |
| Design-to-code | Очень сильный | Очень сильный | Средний |
| Code-to-Figma / генерация | Сильный | Сильный | Сильный, особенно в local mode |
| Plugin debugging | Ограниченно | Не про это | Очень сильный |

## Практический вывод

### Если нужен официальный Figma-native workflow

Лучше выбирать:

- `Figma MCP Server`
- плюс `Figma MCP Skills`

Эта связка особенно хороша, если нужно:

- читать дизайн-контекст
- связывать дизайн с кодом
- работать с Code Connect
- генерировать или обновлять экраны по официальным сценариям

### Если нужен audit, review automation и design system maintenance

Лучше выбирать:

- `Figma Console MCP`

Он особенно хорош, если нужно:

- валидировать variables и scopes
- искать detached tokens
- проверять naming и assignments
- делать maintenance-задачи по библиотеке
- отлаживать plugin workflow

### Если нужен сильный Review AI

На практике лучший вариант не обязательно выбирать один:

- `Figma MCP Server + Skills` использовать для контекста, соответствия продукту, design-to-code и работы с официальными сценариями
- `Figma Console MCP` использовать для технических проверок, автоматизации ревью, maintenance и debug

## Что это значит именно для задач ревью

### Что логично отдать official Figma MCP + skills

- поиск и чтение референсов по компоненту
- понимание структуры компонента и его связи с кодом
- сравнение с системными паттернами
- поддержка design-to-code и implementation review

### Что логично отдать Figma Console MCP

- проверку variables и token assignments
- проверку detached / broken links
- naming review
- проверки component properties
- технический аудит структуры
- plugin debugging

## На что стоит обратить внимание

- В документации `Figma Console MCP` есть расхождения по количеству инструментов в разных файлах. Это похоже на эффект от обновлений документации в разное время. Поэтому точное число tools лучше не считать главным аргументом.
- `Figma MCP Skills` стоит воспринимать не как отдельную технологию, а как усилитель official MCP.
- `Figma MCP Server` выглядит сильнее как платформа для Figma-native agent workflows.
- `Figma Console MCP` выглядит сильнее как toolbox для точечных проверок, maintenance и debug.

## Источники

- Figma MCP tools and prompts: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- Figma MCP overview: https://developers.figma.com/docs/figma-mcp-server/
- Figma MCP skills repo: https://github.com/figma/mcp-server-guide/tree/main/skills
- `figma-use` skill: https://raw.githubusercontent.com/figma/mcp-server-guide/main/skills/figma-use/SKILL.md
- `figma-implement-design` skill: https://raw.githubusercontent.com/figma/mcp-server-guide/main/skills/figma-implement-design/SKILL.md
- `figma-generate-design` skill: https://raw.githubusercontent.com/figma/mcp-server-guide/main/skills/figma-generate-design/SKILL.md
- `figma-create-new-file` skill: https://raw.githubusercontent.com/figma/mcp-server-guide/main/skills/figma-create-new-file/SKILL.md
- `figma-generate-library` skill: https://raw.githubusercontent.com/figma/mcp-server-guide/main/skills/figma-generate-library/SKILL.md
- Figma Console MCP docs: https://github.com/southleft/figma-console-mcp/tree/main/docs
- Figma Console MCP tools: https://raw.githubusercontent.com/southleft/figma-console-mcp/main/docs/tools.md
- Figma Console MCP mode comparison: https://raw.githubusercontent.com/southleft/figma-console-mcp/main/docs/mode-comparison.md
- Figma Console MCP comparison doc: https://raw.githubusercontent.com/southleft/figma-console-mcp/main/docs/figma-mcp-vs-figma-console-mcp.md
