/**
 * Summary:
 *      The main app of List Tree!
 */

var DROPBOX_APP_KEY = 'nvhuh359xzvfexc';

var client = new Dropbox.Client({key: DROPBOX_APP_KEY});

$(function (){
    var taskTable, taskTableId = "tasks", $main = $("#main"), $listsList = $("#listsList");
    var archiveTable, archiveTableId = "archive";
    var listTable, listTableId = "lists";
    var config, configTable, configTableId = "config"; // literally just keeps track of which list is focused

    var focusedList = null;

    $('#loginButton').click(function(e){
        e.preventDefault();
        client.authenticate();
    });

    // tries auth with cached credentials
    client.authenticate({interactive:false}, function(error){
        if (error){
            alert("Authentication error: " + error);
        }
    });

    if (client.isAuthenticated()) {
        $("#loginButton").hide();
        $main.show();

        client.getDatastoreManager().openDefaultDatastore(function (error, datastore){

            if (error) {
                alert("Error opening default datastore: " + error);
            }

            taskTable = datastore.getTable(taskTableId);
            archiveTable = datastore.getTable(archiveTableId);
            listTable = datastore.getTable(listTableId);
            configTable = datastore.getTable(configTableId);

            var configs = configTable.query({});
            // first time use. add a config object focused on All
            if (configs.length === 0) {
                config = configTable.insert(TaskTree.buildConfig());
            } else {
                config = configs[0];
            }
            if (config.has("focusedListId")) {
                focusedList = listTable.get(config.get("focusedListId"));
            }

            setupTabs();

            // periodically update the UI

            // create archive objects for days since last

            // add global listeners
            addGlobalListButtons();
            addGlobalElements();

            paintTabContainer();

            // add records changed listeners
            addRecordsChangedListeners(datastore);
        })
    }

    // UI Listener setup

    /**
     * Wipes the whole tab container. This happens when you switch the focused list.
     */
    function paintTabContainer(){
        renderTaskForest();
        updateArchiveList();
        updateListsList();
        var logDurationData = _.map(getDurationData(), function(durationMs){
            return Math.log(durationMs);
        });
        console.log("log duration data: " + logDurationData);
        var formatLogDuration = function(logD) {
            // input will actually be log of duration in ms
            var d = Math.floor(Math.exp(logD));
            return jsUtil.humanReadableShort(d);
        };
        buildHistogram(logDurationData, formatLogDuration);
    }

    /**
     * Renders the task tree for the currently focused list
     */
    function renderTaskForest(){
        console.log(focusedList);
        $main.find(".subtasks").first().empty();
        var rootTasks = TreeUtil.allRootRecords(taskTable);
        var focusedRoots = _.filter(rootTasks, isFocusedTask);
        _.each(focusedRoots, rootTaskChangedCb);
        // make sortable AFTER items added (nested sortable?)
        $main.find(".subtasks").first().sortable();
    }

    /**
     * Sets up the menu tabs so they actually work.
     */
    function setupTabs(){
        $(".navTabs li a").click(function(e){
            e.preventDefault();
            $(this).tab("show");
        });
    }

    /**
     * Adds the listener to the list add button.
     */
    function addGlobalListButtons(){
        $("#listAddForm button").click(function(e){
            e.preventDefault();
            listTable.insert(createListFromForm($("#listAddForm")));
        });
        $("#allLists").click(function(e){
            e.preventDefault();
            console.log("all lists clicked!");
            config.set("focusedListId", null);
        });
    }

    /**
     * Config mutators are the callbacks bound to the list objects. When they're clicked,
     * the focused list changes.
     */
    function addConfigMutator($list){
        $list.click(function (e){
            console.log("list clicked!: " + $list.attr("id"));
            e.preventDefault();
            config.set("focusedListId", $list.attr("id"));
        });
    }

    /**
     * Updates all relevant records when deleting a list.
     * These are the config, the tasks that belong to this list, and the list record itself.
     * @param $listEntry
     */
    function addListDeleteMutator($listEntry){
        $listEntry.find("button.listEntryDel").first().click(function(e){
            e.stopPropagation();
            e.preventDefault();
            console.log("list entry del called!");
            var listId = $(this).parent().attr("id");
            var list = listTable.get(listId);

            // delete all the tasks that belong to this list
            var tasks = taskTable.query({listId: listId});
            _.each(tasks, function(task){
                singleTaskDelete(task);
            });

            // update the config so it doesn't focus on this list
            if (focusedList !== null && focusedList.getId() === listId){
                config.set("focusedListId", null);
            }

            list.deleteRecord();
        });
    }

    /**
     * Sets up the button and form which allows adding a global task
     */
    function addGlobalElements(){
        var $globalCreateTask = $("#globalCreateTask");
        $globalCreateTask.append(ich.taskForm());
        $globalCreateTask.find(".taskForm").hide();

        // button toggles the form
        $globalCreateTask.find("button").click(function (e){
            e.preventDefault();
            $globalCreateTask.find(".taskForm").toggle();
        });

        // have the add button use the global create
        $globalCreateTask.find(".taskAdd").click(globalTaskAddCb);

        $("#globalArchiveCompleted").find("button").click(function (e){
            e.preventDefault();
            archiveCompleted();
        })
    }

    // Archive methods
    /**
     * Archives all completed tasks
     */
    function archiveCompleted(){
        // get all the completed
        var completedTasks = taskTable.query({completed:true});
        // filter out the archived ones
        _.each(_.filter(completedTasks, function(task){
            return !TaskTree.archived(task);
        }), function(task){
            console.log("archiving : " + task.getId());

            // this task was unarchived, so archive it
            TaskTree.toggleArchived(task);

            var completeTime = task.get("completeTime");
            var completeDate = jsUtil.roundDay(completeTime);

            // see if there's already an archive entry for this date
            var archiveEntrys = archiveTable.query({"date": completeDate});
            var archiveEntry;
            if (archiveEntrys.length === 0) {
                archiveEntry = archiveTable.insert(TaskTree.buildArchiveEntry(completeDate));
            } else {
                archiveEntry = archiveEntrys[0];
            }
            var archiveEntryTasks = archiveEntry.get("tasks").toArray();
            if (_.indexOf(archiveEntryTasks, task.getId()) === -1) {
                console.log("updating archive entry tasks");
                archiveEntryTasks.unshift(task.getId());
                archiveEntry.set("tasks", archiveEntryTasks);
            }
        });
    }


    // UI Listener callbacks
    /**
     * Adds all the UI listeners for tasks
     * @param $root
     */
    function addTaskMutators($root) {
        var $taskForm = $root.find(".taskForm").first();

        var id = $root.attr("id");
        var task = taskTable.get(id);

        // delete callback (records changed listener)
        $root.find("button.taskDel").first().click(function(e){
            e.preventDefault();
            subtreeTaskDelete(task);
        });

        // toggle task form
        $root.find("button.showTaskForm").first().click(function(e){
            e.preventDefault();
            $taskForm.toggle();
        });

        // checkbox (records changed listener)
        // first() is necessary here to prevent additional callbacks on children
        $root.find("input[name='targetCompleted']").first().click(function(e){
            e.preventDefault();
            var checked = $(this).is(":checked");
            var completeTime = null;
            if (checked) {
                completeTime = new Date();
            }
            updateCompletionSubtree(task, completeTime);
            // update the task itself
            TaskTree.setCompleted(task, completeTime);
            updateCompletionAncestors(task, completeTime);
        });

        // task add
        $taskForm.find("button.taskAdd").first().click(taskAddCb);

        // toggle duration
        $root.find("button.showDuration").first().click(function (e){
            e.preventDefault();
            TaskTree.toggleShowDuration(task);
            //$root.find(".duration").first().toggle();
        });

        // toggle subtask list visibility
        $root.find("button.showSubtasks").first().click(function (e){
            e.preventDefault();
            TaskTree.toggleExpanded(task);
            //$root.find(".subtasks").first().toggle();
        });
    }

    //////////////////////////////////////////////////////////////////////////////////////////////
    /// RECORD MUTATING FUNCTIONS
    //////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Invoked when task form for adding a global task is submitted.
     * @param e
     */
    function globalTaskAddCb(e){
        e.preventDefault();
        var $parent = $(this).closest(".taskForm");
        createTaskFromForm($parent, TreeUtil.NO_PARENT);
    }

    /**
     * Invoked when task form for adding a subtask of task is submitted.
     * @param e
     */
    function taskAddCb(e){
        console.log("task add cb invoked");
        e.preventDefault();
        var $this = $(this),
            $parentTask = $this.closest(".task").first(),
            $parent = $this.parent();
        var created = createTaskFromForm($parent, $parentTask.attr("id"));
        updateCompletionAncestors(created, null);
    }

    /**
     *
     * @param $listForm
     * @returns {{name: *, createTime: *, tasks: Array}}
     */
    function createListFromForm($listForm){
        var name = $listForm.find("input[name='name']").val();
        return TaskTree.buildList(name, new Date());
    }

    /**
     * Puts a new task in the table. Still need to figure out weighting that
     * feels natural.
     * @param $parent {Zepto element}. Zepto selector on parent div.
     * @param parentId {String}. Id of parent task.
     * @returns {Datastore.Record}. The created task.
     */
    function createTaskFromForm($parent, parentId){
        var desc = $parent.find("input[name='desc']").val();
        var focusedId = null;
        if (focusedList !== null){
            focusedId = focusedList.getId();
        }
        return TreeUtil.createTreeRecord(TaskTree.buildTask(parentId, desc, 0.0, false, false,
            focusedId),
            taskTable, taskTable, TaskTree.CHILD_LIST_FIELD);
    }

    /**
     * Cleanup that happens on a single task record when it or one of its parents gets
     * deleted.
     * @param task
     */
    function singleTaskDelete(task){
        if (TaskTree.completed(task) && TaskTree.archived(task)){
            unarchiveTask(task);
        }
        TreeUtil.deleteTreeRecord(task, taskTable, TaskTree.CHILD_LIST_FIELD);
    }

    /**
     * Takes care of all the bookkeeping when a task gets deleted.  Need to do this
     * because we can't get the fields of deleted records.
     * @param task
     */
    function subtreeTaskDelete(task){
        updateCompletionAncestors(task, true);
        TreeUtil.onTreeBottomUp(task, taskTable, function(task){
           singleTaskDelete(task);
        }, TaskTree.CHILD_LIST_FIELD);
    }

    /**
     * Task assumed to be completed and archived
     * @param task
     */
    function unarchiveTask(task){
        var completeDate = jsUtil.roundDay(task.get("completeTime"));
        var archiveEntrys = archiveTable.query({date:completeDate});
        if (archiveEntrys.length === 0) {
            // should not get here
            return;
        }
        var archiveEntry = archiveEntrys[0];
        var archivedTaskIds = archiveEntry.get("tasks").toArray();
        var archivedTasks = DatastoreUtil.bulkGet(taskTable, archivedTaskIds);
        var newArchivedtasks = _.filter(archivedTasks, function(archivedTask){
            return archivedTask.getId() !== task.getId();
        });
        var newArchivedTaskIds = _.map(newArchivedtasks, function(archivedTask){
            return archivedTask.getId();
        });
        if (newArchivedTaskIds.length === 0) {
            archiveEntry.deleteRecord();
        } else {
            archiveEntry.set("tasks", newArchivedTaskIds);
        }
        task.set("archived", null);
    }

    /**
     * Update completion on the subtree rooted at task.
     * @param task
     * @param completeTime. {Date}. Can be null, indicated update to incomplete.
     */
    function updateCompletionSubtree(task, completeTime) {
        // complete all incomplete tasks on the subtree
        TreeUtil.onTreeBottomUp(task, taskTable, function(subtask){
            if (!TaskTree.completed(subtask)) {
                TaskTree.setCompleted(subtask, completeTime);
            }
        }, TaskTree.CHILD_LIST_FIELD);
    }

    /**
     * Update completion on the ancestors of task, in bottom up order.
     * Want to do just 1 update.
     * @param task
     * @param completeTime {Date}. Can be null, indicating update to incomplete.
     */
    function updateCompletionAncestors(task, completeTime) {
        // compute subtask completion for the parent
        TreeUtil.onAncestorsBottomUp(task, taskTable, function(ancestor){
            var completionFields = {};
            // un-completing a subtask makes all ancestors incomplete
            if (completeTime === null) {
                completionFields.completeTime = null;
                completionFields.completed = null;
            }
            completionFields.completion = taskCompletion(ancestor);
            ancestor.update(completionFields);
        });
    }

    // Rendering fn. These are all rendering helpers...
    /**
     * Computes the data necessary for rendering a task.
     * @param task
     * @returns {Object}
     */
    function taskRenderData(task){
        var ret = DatastoreUtil.getFieldValuesWithId(task);
        var completed = TaskTree.completed(task);
        var percentage = taskCompletion(task);
        var duration = taskDuration(task);

        var prefix = "Open for ";
        if (completed) {
            prefix = "Took ";
        }
        var durationStr = prefix + jsUtil.humanReadable(duration);

        ret.percent = percentage;
        ret.durationStr = durationStr;
        return ret;
    }

    // These functions actually don't mutate anything.  Can probably even get moved out.
    /**
     * Returns the duration of the task.  If the task is completed,
     * @param task
     * @returns {number}. Duration of the task in ms.
     */
    function taskDuration(task){
        var startTime = task.get("createTime"), endTime = new Date();
        if (TaskTree.completed(task)) {
            endTime = task.get("completeTime");
        }
        return endTime - startTime;
    }

    /**
     * Returns completion status of this task as a percentage.
     * @param task
     * @returns {number}
     */
    function taskCompletion(task){
        var subtaskIds = task.get(TaskTree.CHILD_LIST_FIELD).toArray();
        var subtasks = DatastoreUtil.bulkGet(taskTable, subtaskIds);

        // no subtasks
        if (subtasks.length === 0) {
            return 100.0;
        }

        var sum = function(a,b){
            return a+b;
        }

        var doneWeight = _.reduce(DatastoreUtil.getFieldValues(_.filter(subtasks, function(subtask){
            return TaskTree.completed(subtask);
        }), "weight"), sum, 0);
        var totalWeight = _.reduce(DatastoreUtil.getFieldValues(subtasks, "weight"), sum, 0);
        return doneWeight / totalWeight * 100.0;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////
    /// RENDERING FUNCTIONS
    //////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Renders the task subtree rooted at task (including task itself).
     * Assumes the immediate child elements have already been rendered.
     * @param task. {Datastore.Record}. Task to be rendered
     * @returns {Zepto element}. Zepto selector on div for task. Subtree
     *      rooted at task is fully rendered.
     */
    function renderTask(task){
        console.log("rendering task: " + task.get("desc"));
        var data = taskRenderData(task);
        var $task = ich.task(data);

        // attach the task form and hide
        var $taskForm = ich.taskForm();
        $taskForm.hide();
        $task.find(".taskForm").first().replaceWith($taskForm);

        // render the children and attach
        renderSubtasks(task, $task);
        renderTaskState(task, $task);
        addTaskMutators($task);
        return $task;
    }

    /**
     * Applies the rendering status of task to the task el.
     *
     * @param task
     * @param $task
     */
    function renderTaskState(task, $task){
        // mark completed
        if (TaskTree.completed(task)) {
            $task.find(".completeBox").first().find("input").attr("checked", "true");

            // does strikethrough. this is pretty groddy
            $task.addClass("completed");
        }

        if (!TaskTree.showDuration(task)){
            $task.find(".duration").first().hide();
        }

        if (!TaskTree.expanded(task)){
            $task.find(".subtasks").first().hide();
        }
    }

    /**
     * Adds the subtasks to $task
     * @param task
     * @param $task
     */
    function renderSubtasks(task, $task) {
        var childIds = task.get(TaskTree.CHILD_LIST_FIELD).toArray();
        var children = _.map(childIds, function(childId){
            return taskTable.get(childId);
        });

        // do not render the archived children
        children = _.filter(children, function(child){
            return !TaskTree.archived(child);
        });

        var $subtasksList = $task.find(".subtasks").first();
        $subtasksList.empty();
        _.each(children, function(child){
            var $child = $("#" + child.getId());
            if ($child.length === 0) {
                $child = renderTask(child);
            } else {
                $child = $child.first();
            }
            $subtasksList.append($child);
        });
        // make sortable AFTER items added
        $subtasksList.sortable();
    }

    // RecordsChanged callbacks
    /**
    * Renders the task and adds it to the dom.
    * @param task
    * @param $parent
    */
    function taskChangedCb(task, $parent) {
        if (TaskTree.archived(task)) {
            $("#" + task.getId()).remove();
            return;
        }

        var $task = renderTask(task);
        var $prev = $parent.find("#" + task.getId());
        var $subtaskList;
        if ($prev.length === 0) {
            console.log("task: " + task.get("desc") + " added");
            // new task added. really this is only needed for roots...
            // renderTask takes care of the rest.
            $subtaskList = $parent.find(".subtasks").first();
            $subtaskList.prepend($task);
        } else {
            console.log("task: " + task.get("desc") + " updated");
            // task updated
            $prev.replaceWith($task);
        }
    }

    /**
     *
     * @param task
     */
    function rootTaskChangedCb(task) {
        taskChangedCb(task, $main);
        // need to bind listener to new element in root case
        $main.find(".subtasks").first().sortable();
    }

    /**
     *
     * @param task
     */
    function childTaskChangedCb(task) {
        var parentId = task.get(TreeUtil.PARENT_ID_FIELD);
        var parent = taskTable.get(parentId);
        var $parent = $("#" + parent.getId());
        taskChangedCb(task, $parent);
    }

    /**
     * Deletes all el's associated with record from the ui
     * @param record
     */
    function delCb(record) {
        console.log("delete task cb called");
        $("#" + record.getId()).remove();
        // remove the archived el too
        $("#archived-" + record.getId()).remove();
    }

    /**
     *
     * @param task
     * @returns {boolean}. True if the task belongs to focused list (or focused list is null,
     *      which means the All list)
     */
    function isFocusedTask(task){
        if (focusedList === null){
            return true;
        }
        return task.get("listId") === focusedList.getId();
    }

    /**
     * Just renders an archive entry
     * @param archiveEntry
     */
    function renderArchiveEntry(archiveEntry) {
        // remove if it has no children
        var archiveEntryData = DatastoreUtil.getFieldValuesWithId(archiveEntry);
        archiveEntryData.numTasks = archiveEntry.get("tasks").length();
        var $archiveEntry = ich.archiveEntry(archiveEntryData);
        var $taskList = $archiveEntry.find("ul.tasks").first();
        var tasks = getArchiveEntryTasks(archiveEntry);
        tasks = _.filter(tasks, isFocusedTask);
        _.each(tasks, function(task){
            $taskList.append(renderArchivedTask(task));
        });
        $archiveEntry.append($taskList);
        renderArchiveEntryState(archiveEntry, $archiveEntry);
        return $archiveEntry;
    }

    function getArchiveEntryTasks(archiveEntry){
        var taskIds = archiveEntry.get("tasks").toArray();
        return DatastoreUtil.bulkGet(taskTable, taskIds);
    }

    function renderArchiveEntryState(archiveEntry, $archiveEntry){
        if (!TaskTree.expanded(archiveEntry)){
            $archiveEntry.find(".tasks").first().hide();
        }
    }

    function renderArchivedTask(task){
        var taskData = taskRenderData(task);
        var $task = ich.archivedTask(taskData);
        renderArchivedTaskState(task, $task);
        return $task;
    }

    function renderArchivedTaskState(task, $task){
        var parent;
        if (!TreeUtil.isRoot(task)){
            parent = taskTable.get(task.get(TreeUtil.PARENT_ID_FIELD));
            if (TaskTree.archived(parent)) {
                $task.find("button.unarchive").first().hide();
            }
        }
    }


    /**
     * Rerenders the archive list in sorted order. Invoked whenever there's a change
     * in the archive entries.
     * @param archiveEntry
     */
    function updateArchiveList(){
        var $archiveList = $("#archiveList");
        $archiveList.empty();

        var archiveEntrys = archiveTable.query({});

        archiveEntrys = _.filter(archiveEntrys, function(archiveEntry){
            if (focusedList === null) {
                return true;
            }
            var tasks = getArchiveEntryTasks(archiveEntry);
            tasks = _.filter(tasks, function(task){
                return task.get("listId") === focusedList.getId();
            });
            return tasks.length > 0;
        });

        archiveEntrys.sort(function(lhs, rhs){
            if (lhs.get("date") > rhs.get("date")) {
                return -1;
            }
            if (lhs.get("date") < rhs.get("date")) {
                return 1;
            }
            return 0;
        });

        _.each(archiveEntrys, function(archiveEntry){
            var $archiveEntry = renderArchiveEntry(archiveEntry);
            $archiveList.append($archiveEntry);
            addArchiveButtonListeners($archiveEntry);
        });
    }

    /**
     * Adds buttons listeners to an archiveEntry
     * @param $archiveEntry
     */
    function addArchiveButtonListeners($archiveEntry){
        var id = $archiveEntry.attr("id");
        var archiveEntry = archiveTable.get(id);
        var prefixLen = "archived-".length;
        $archiveEntry.find("button.showTasks").click(function(e){
            e.preventDefault();
            TaskTree.toggleExpanded(archiveEntry);
            $(this).focus();
        });

        $archiveEntry.find("button.unarchive").click(function(e){
            e.preventDefault();
            var task = getArchivedTaskFromButton($(this), prefixLen);
            unarchiveTask(task);
        });

        $archiveEntry.find("button.taskDel").click(function(e){
            e.preventDefault();
            var task = getArchivedTaskFromButton($(this), prefixLen);
            subtreeTaskDelete(task);
        });
    }

    /**
     * Helper method for the archiveEntry child listeners
     * @param $button
     * @param prefixLen
     * @returns {*}
     */
    function getArchivedTaskFromButton($button, prefixLen){
        var $archivedTask = $button.closest(".archivedTask").first();
        // hacky string stuff...
        var id = $archivedTask.attr("id").substr(prefixLen);
        return taskTable.get(id);
    }

    /**
     * Callback invoked when archiveEntries changed.  Renders archive entry
     * @param rcEvent
     */
    function archiveCb(rcEvent) {
        var archiveEntrys = rcEvent.affectedRecordsForTable(archiveTable.getId());
        // should delete the ones which don't have any contents. will cause another cb
        // rerender these
        //_.each(archiveEntrys, renderArchiveEntry);
        updateArchiveList();
    }

    /**
     * Invoked when list records are mutated.
     * @param rcEvent
     */
    function listAddCb(rcEvent){
        updateListsList();
    }

    /**
     * Just does a dumb refresh of the list.
     */
    function updateListsList(){
        var listEntrys = listTable.query({});
        $listsList.empty();
        var $listEntrys = _.map(listEntrys, function(listEntry){
            return renderListEntry(listEntry);
        });

        // add mutators
        _.each($listEntrys, function($listEntry){
            addConfigMutator($listEntry);
            addListDeleteMutator($listEntry);
        });

        _.each($listEntrys, function($listEntry){
            $listsList.append($listEntry);
        });

        $listsList.sortable();
    }

    /**
     *
     * @param listEntry
     */
    function renderListEntry(listEntry){
        return ich.listEntry(DatastoreUtil.getFieldValuesWithId(listEntry));
    }

    function $tabContentMutator(rcEvent){
        var configs = rcEvent.affectedRecordsForTable(configTable.getId());
        if (configs.length === 0){
            return;
        }
        var config = configs[0];
        if (config.has("focusedListId")){
            focusedList = listTable.get(config.get("focusedListId"));
        } else {
            focusedList = null;
        }
        paintTabContainer();
    }

    /**
     * Returns the task durations of completed tasks belonging to focused list.
     * @returns {*}
     */
    function getDurationData(){
        var queryParam = { completed: true};
        if (focusedList !== null){
            queryParam.listId = focusedList.getId();
        }
        var focusedCompletedTasks = taskTable.query(queryParam);
        printFocusedList();
        console.log("# focused completed: " + focusedCompletedTasks.length);
        return _.map(focusedCompletedTasks, function(focusedCompletedTask){
            return focusedCompletedTask.get("completeTime") - focusedCompletedTask.get("createTime");
        });
    }

    function printFocusedList() {
        if (focusedList !== null) {
            console.log("focused list: " + focusedList.get("name"));
        } else {
            console.log("focused list: all");
        }
    }

    /**
     * Builds a histogram. lifted from http://bl.ocks.org/mbostock/3048166
     * @param values
     */
    function buildHistogram(values, xformat){
        var margin = {top: 10, right: 30, bottom: 30, left: 30};
        var width = 500;
        var height = 500;

        var $histogram = $("#histogram")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
        $("#histogram").empty();
        if (values.length < 2) {
            $histogram.text("Not enough tasks completed to plot histogram!");
            return;
        }

        var formatCount = d3.format(",.0f");

        var x = d3.scale.linear()
            .domain([_.min(values), _.max(values)])
            .range([0,width]);

        var data = d3.layout.histogram()
            .bins(x.ticks(15))
            (values);

        var y = d3.scale.linear()
            .domain([0, d3.max(data, function(d) { return d.y; })])
            .range([height,0]);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .tickFormat(xformat);

        var container = d3.select("#histogram")
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var bar = container.selectAll(".bar")
            .data(data)
            .enter().append("g")
            .attr("class", "bar")
            .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"});

        bar.append("rect")
            .attr("x", 1)
            .attr("width", x(_.min(values) + data[0].dx))
            .attr("height", function(d) { return height - y(d.y); });

        bar.append("text")
            .attr("dy", ".75em")
            .attr("y", 6)
            .attr("x", x(_.min(values) + data[0].dx) / 2)
            .attr("text-anchor", "middle")
            .text(function(d) { return formatCount(d.y); });

        container.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

    }

    /**
     * adds records changed listeners to datastore.
     * @param datastore {Datastore}
     */
    function addRecordsChangedListeners(datastore){
        var rcRootCb = TreeUtil.rcOnRoots(taskTable, rootTaskChangedCb);
        var rcChildCb = TreeUtil.rcOnChildren(taskTable, childTaskChangedCb);
        var rcDelCb = TreeUtil.rcOnDeleted(taskTable, delCb);
        datastore.recordsChanged.addListener(rcRootCb);
        datastore.recordsChanged.addListener(rcChildCb);
        datastore.recordsChanged.addListener(rcDelCb);
        datastore.recordsChanged.addListener(archiveCb);
        datastore.recordsChanged.addListener(listAddCb);
        datastore.recordsChanged.addListener($tabContentMutator);
    }

});

