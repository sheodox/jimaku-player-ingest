<style>
    .panel {
        width: 50rem;
        max-width: 98rem;
        align-self: center;
        padding: 1rem;
    }
</style>

{#if $detection}
    <div class="panel">
        <label for="detection-progress">Scanning videos ({$detection.done} / {$detection.total})</label>
        <Progress id="detection-progress" value={$detection.done} max={$detection.total} />
        <table>
            <tr>
                <th scope="row">Scanning</th>
                <td>{$detection.currentVideo}</td>
            </tr>
        </table>
    </div>
{/if}

<script>
    import {Progress} from 'sheodox-ui';
    import {detection} from './progress';
</script>