import sys, json

def main():
    lines = sys.stdin.readlines()
    data = json.loads(lines)
    
    print(data)
    sys.stdout.flush()
    
if __name__ == '__main__':
    main()