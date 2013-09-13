/**
 * Summary:
 *      The main app of List Tree!
 */

var DROPBOX_APP_KEY = 'nvhuh359xzvfexc';

var client = new Dropbox.Client({key: DROPBOX_APP_KEY});

$(function (){
    var taskTable, taskTableId = "tasks", $main = $("#main");

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

            // add global listeners
            addGlobalElements();

            // render existing tasks
            _.each(TreeUtil.allRootRecords(taskTable), rootTaskChangedCb);

            // add records changed listeners
            addRecordsChangedListeners(datastore);
        })
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
    }

    // UI Listener callbacks
    /**
     * Invoked when task form for adding a global task is submitted.
     * @param e
     */
    function globalTaskAddCb(e){
        e.preventDefault();
        var $parent = $(this).closest(".taskForm");
        var created = createTaskFromForm($parent, TreeUtil.NO_PARENT);
        updateCompletionSubtree(created, null);
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
        updateCompletionSubtree(created, null);
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
        var $taskForm = $root.children(".taskForm").first();

        var id = $root.attr("id");
        var task = taskTable.get(id);

        // delete callback (records changed listener)
        $root.children("button.taskDel").click(function(e){
            e.preventDefault();
            updateCompletionAncestors(task, true);
            TreeUtil.onTreeBottomUp(task, taskTable, function(task){
                TreeUtil.deleteTreeRecord(task, taskTable, TaskTree.CHILD_LIST_FIELD);
            }, TaskTree.CHILD_LIST_FIELD);
        });

        // toggle task form
        $root.children("button.showTaskForm").click(function(e){
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
        $root.children("button.showCompletion").click(function (e){
            e.preventDefault();
            $root.children(".completion").toggle();
        });

        // toggle duration
        $root.children("button.showDuration").click(function (e){
            e.preventDefault();
            $root.children(".duration").toggle();
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
        // un-completing a subtask makes all ancestors incomplete
        if (completeTime === null) {
            TreeUtil.onAncestorsBottomUp(task, taskTable, function(ancestor){
                ancestor.set("completeTime", null);
            });
        }
        // compute subtask completion for the parent
        TreeUtil.onAncestorsBottomUp(task, taskTable, function(ancestor){
            ancestor.set("completion", taskCompletion(ancestor));
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
        var durationStr = prefix + humanReadable(duration);

        ret.percent = percentage;
        ret.durationStr = durationStr;
        return ret;
    }

    /**
     * A generic time utility that most certainly doesn't belong here.
     * @param timeMs
     * @returns {string}
     */
    function humanReadable(timeMs) {
        var days, hours, minutes, tmp = Math.floor((timeMs/1000)/60);
        minutes = tmp % 60;
        tmp = Math.floor(tmp / 60);
        hours = tmp % 24;
        days = Math.floor(tmp / 24);
        return days + " days, " + hours + " hours, " + minutes + " minutes";
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

        // render the children and attach
        var childIds = task.get(TaskTree.CHILD_LIST_FIELD).toArray();
        var children = _.map(childIds, function(childId){
            return taskTable.get(childId);
        });
        var $subtasksList = $task.children(".subtasks");
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

        // attach the task form and hide
        var $taskForm = ich.taskForm();
        $taskForm.hide();
        $task.append($taskForm);

        if (TaskTree.completed(task)) {
            $task.children(".completeBox").first().find("input").attr("checked", "true");

            // does strikethrough. this is pretty groddy
            $task.addClass("completed");

        }
        addButtonListeners($task);

        return $task;
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
        if ($prev.length === 0) {
            // new task added. really this is only needed for roots...
            // renderTask takes care of the rest.
            console.log("[jQuery] adding task: " + task.get("desc"));
            $parent.children(".subtasks").first().append($task);
        } else {
            // task updated
            console.log("[jQuery] modifying task: " + task.get("desc"));
            $prev.replaceWith($task);
        }
    }

    /**
     *
     * @param task
     */
    function rootTaskChangedCb(task) {
        taskChangedCb(task, $main);
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
    }

});

