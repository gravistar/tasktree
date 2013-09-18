/**
 * Summary:
 *      The main app of List Tree!
 */

var DROPBOX_APP_KEY = 'nvhuh359xzvfexc';

var client = new Dropbox.Client({key: DROPBOX_APP_KEY});

$(function (){
    var taskTable, taskTableId = "tasks", $main = $("#main");
    var archiveTable, archiveTableId = "archive";

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

            // periodically update the UI

            // create archive objects for days since last

            // add global listeners
            addGlobalElements();

            // update the archive
            updateArchiveList();

            // render existing tasks
            _.each(TreeUtil.allRootRecords(taskTable), rootTaskChangedCb);

            // make sortable AFTER items added
            $main.find(".subtasks").first().sortable();

            // add records changed listeners
            addRecordsChangedListeners(datastore);
        })
    }

    // Archive methods
    function addArchiveDates() {
        var archiveEntries = archiveTable.query();
        var today = jsUtil.roundDay(new Date());
        var mostRecent = _.max(archiveEntries, function(archiveEntry){
            return archiveEntry.get("date");
        });
    }


    // UI Listener setup
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

        $("#globalShowCompleted").find("button").click(function (e){
            e.preventDefault();
            $(".completed").not(".archived").toggle();
        });

        $("#globalArchiveCompleted").find("button").click(function (e){
            e.preventDefault();
            archiveCompleted();
        })
    }

    // Archive methods
    function archiveCompleted(){
        // get all the completed
        var $completedEls = $(".completed");
        $completedEls.each(function(){
            var taskId = $(this).attr("id");
            console.log("archiving : " + taskId);
            var task = taskTable.get(taskId);
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
        // should this go here?
        $completedEls.hide();
    }


    // UI Listener callbacks
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
            $parentTask = $this.closest(".task"),
            $parent = $this.parent();
        var created = createTaskFromForm($parent, $parentTask.attr("id"));
        updateCompletionAncestors(created, null);
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
        return TreeUtil.createTreeRecord(TaskTree.buildTask(parentId, desc, 0.0, false, false),
            taskTable, taskTable, TaskTree.CHILD_LIST_FIELD);
    }

    /**
     * Adds all the UI listeners
     * @param $root
     */
    function addButtonListeners($root) {
        var $taskForm = $root.find(".taskForm").first();

        var id = $root.attr("id");
        var task = taskTable.get(id);

        // delete callback (records changed listener)
        $root.find("button.taskDel").first().click(function(e){
            e.preventDefault();
            updateCompletionAncestors(task, true);
            TreeUtil.onTreeBottomUp(task, taskTable, function(task){
                TreeUtil.deleteTreeRecord(task, taskTable, TaskTree.CHILD_LIST_FIELD);
            }, TaskTree.CHILD_LIST_FIELD);
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
            updateCompletionAncestors(task, completeTime);
        });

        // task add
        $taskForm.find("button.taskAdd").click(taskAddCb);

        // toggle completion
        $root.find("button.showCompletion").first().click(function (e){
            e.preventDefault();
            $root.find(".completion").first().toggle();
        });

        // toggle duration
        $root.find("button.showDuration").first().click(function (e){
            e.preventDefault();
            $root.find(".duration").first().toggle();
        });

        // toggle subtask list visibility
        $root.find("button.showSubtasks").first().click(function (e){
            e.preventDefault();
            $root.find(".subtasks").first().toggle();
        });
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
                subtask.set("completeTime", completeTime);
            }
        }, TaskTree.CHILD_LIST_FIELD);
        // this needs to happen because if
        // the task is completed, it won't be set to
        // incomplete on the previous line.
        // not sure of a better way atm
        task.set("completeTime", completeTime);
    }

    /**
     * Update completion on the ancestors of task, in bottom up order.
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
            }
            completionFields.completion = taskCompletion(ancestor);
            ancestor.update(completionFields);
        });
    }

    // Rendering fn
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
        $task.append($taskForm);

        if (TaskTree.completed(task)) {
            $task.find(".completeBox").first().find("input").attr("checked", "true");

            // does strikethrough. this is pretty groddy
            $task.addClass("completed");
        }
        // render the children and attach
        renderSubtasks(task, $task);
        addButtonListeners($task);
        return $task;
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
        var $subtasksList = $("<ul></ul>");
        $subtasksList.addClass("subtasks")
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
        $task.append($subtasksList);
    }

    // RecordsChanged callbacks
    /**
    * Renders the task and adds it to the dom.
    * @param task
    * @param $parent
    */
    function taskChangedCb(task, $parent) {
        var $task = renderTask(task);
        var $prev = $parent.find("#" + task.getId());
        var $subtaskList;
        if ($prev.length === 0) {
            // new task added. really this is only needed for roots...
            // renderTask takes care of the rest.
            $subtaskList = $parent.find(".subtasks").first();
            $subtaskList.prepend($task);
        } else {
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
     *
     * @param record
     */
    function delCb(record) {
        console.log("delete task cb called");
        $("#" + record.getId()).remove();
    }

    /**
     * Just renders an archive entry
     * @param archiveEntry
     */
    function renderArchiveEntry(archiveEntry) {
        // remove if it has no children
        var archiveEntryData = DatastoreUtil.getFieldValuesWithId(archiveEntry);
        var $archiveEntry = ich.archiveEntry(archiveEntryData);
        var $taskList = $("<ul></ul>").addClass("tasks");
        var taskIds = archiveEntry.get("tasks").toArray();
        var tasks = DatastoreUtil.bulkGet(taskTable, taskIds);
        _.each(tasks, function(task){
            var taskData = taskRenderData(task);
            var $task = ich.archivedTask(taskData);
            $taskList.append($task);
        });
        return $archiveEntry.append($taskList);
    }

    /**
     * Rerenders the archive list in sorted order. Invoked whenever there's a change
     * in the archive entries.
     * @param archiveEntry
     */
    function updateArchiveList(){
        console.log("updating archive list");
        var $archiveList = $("#archiveList");
        $archiveList.empty();

        var archiveEntrys = archiveTable.query();
        console.log("num archive entries: " + archiveEntrys.length);
        archiveEntrys.sort(function(lhs, rhs){
            if (lhs.get("date") < rhs.get("date")) {
                return -1;
            }
            if (lhs.get("date") > rhs.get("date")) {
                return 1;
            }
            return 0;
        });
        _.each(archiveEntrys, function(archiveEntry){
            $archiveList.append(renderArchiveEntry(archiveEntry));
        });
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
    }

});

