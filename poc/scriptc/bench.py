import subprocess, time, sys, statistics, os
def bench(label, cmd, n=10, cwd=None):
    # warm
    subprocess.run(cmd, capture_output=True, cwd=cwd)
    ts=[]
    for _ in range(n):
        t0=time.perf_counter()
        r=subprocess.run(cmd, capture_output=True, cwd=cwd)
        ts.append((time.perf_counter()-t0)*1000)
    ts.sort()
    print(f"{label:<45} median {statistics.median(ts):7.1f} ms   min {ts[0]:7.1f}   max {ts[-1]:7.1f}   rc={r.returncode}")
    return statistics.median(ts)
if __name__=="__main__":
    pass
